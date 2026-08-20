import { Column, SQL, getColumnTable, getTableName, is } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";
import type { SelectedFieldsOrdered } from "drizzle-orm/operations";

// Note: db0 connectors always return object rows keyed by the driver's column
// name, while drizzle asks its drivers for positional arrays (`mode: "arrays"`)
// and reads `row[index]` against the fields the query selected. Every selected
// field therefore has to be looked up by name and handed back in select order.
// Fields that the driver cannot key uniquely (two same-named columns from
// different tables in a join) are rejected upfront by `assertUnambiguous()`,
// because there is no way to tell the two values apart at this layer. Drizzle's
// relational query builder emits unique aliases, so relational queries are
// unaffected.
//
// Decoding, nesting and left-join nulling are drizzle's job since v1 — the
// mapper it hands to `prepareQuery()` does all of it, so this module only has
// to get the values into the right slots.

/** Turns one db0 object row into the positional array drizzle's mappers read. */
export type RowConverter = (row: Record<string, unknown>) => unknown[];

/** The mappers drizzle passes to `prepareQuery()`. */
type Mapper = (rows: any[]) => any;

type Fields = SelectedFieldsOrdered<AnyColumn>;

type Field = Fields[number]["field"];

/**
 * Converters for the mappers drizzle generated from a known field list, so a
 * session can pick the matching one for the `mapper` it is handed.
 */
const converters = new WeakMap<Mapper, RowConverter>();

/**
 * Fallback for mappers built without a field list — `$count()`, `values()` and
 * the relational query builder, all of which emit unique keys in select order.
 */
const byInsertionOrder: RowConverter = (row) => Object.values(row);

/** The converter registered for `mapper`, or positional key order. */
export function getRowConverter(mapper: Mapper | undefined): RowConverter {
  return (mapper && converters.get(mapper)) ?? byInsertionOrder;
}

interface MapperGenerators {
  rows: (
    columns: Fields,
    joinsNotNullableMap: Record<string, boolean> | undefined,
  ) => Mapper;
}

/**
 * Registers a row converter for every mapper the dialect builds from a field
 * list.
 *
 * `mapperGenerators` is a plain own property of the dialect and drizzle hands
 * the generated mapper straight to `prepareQuery()`, so the mapper doubles as
 * the key identifying the fields it was built for.
 */
export function trackSelectedFields<
  TDialect extends { readonly mapperGenerators: MapperGenerators },
>(dialect: TDialect): TDialect {
  const generators = dialect.mapperGenerators;
  const generateRows = generators.rows;
  generators.rows = (columns, joinsNotNullableMap) => {
    const mapper = generateRows(columns, joinsNotNullableMap);
    converters.set(mapper, createRowConverter(columns));
    return mapper;
  };
  return dialect;
}

/**
 * Row key a field is returned under, or `undefined` when the driver names it
 * after the raw expression text (bare, non-aliased SQL) and it has to be
 * resolved positionally.
 */
function getKey(field: Field): string | undefined {
  if (is(field, Column)) {
    return field.name;
  }
  if (is(field, SQL.Aliased)) {
    return field.fieldAlias;
  }
  return undefined;
}

/** Identifies the value behind a key, to detect fields that collapse into one. */
function getIdentity(field: Field): string {
  return is(field, Column)
    ? `${getTableName(getColumnTable(field))}.${field.name}`
    : `alias.${(field as SQL.Aliased).fieldAlias}`;
}

/**
 * Builds the object row -> select-order array conversion for `fields`, on the
 * first row it is asked to convert: the checks below reject queries db0 cannot
 * map, and a session runs the conversion from inside its executor, so they
 * surface as a rejected query rather than as a throw from the query builder.
 */
function createRowConverter(fields: Fields): RowConverter {
  let convert: RowConverter | undefined;
  return (row) => (convert ??= planRowConverter(fields))(row);
}

function planRowConverter(fields: Fields): RowConverter {
  const keys = fields.map(({ field }) => getKey(field));
  assertUnambiguous(fields, keys);

  if (keys.every((key) => key !== undefined)) {
    return (row) => keys.map((key) => row[key!]);
  }

  // Fields the driver keys by expression text get the row keys no other field
  // claimed, in select order.
  const claimed = new Set(keys.filter((key) => key !== undefined));
  return (row) => {
    const unclaimed = Object.keys(row).filter((key) => !claimed.has(key));
    assertOrdered(unclaimed);
    let index = 0;
    return keys.map((key) => row[key ?? unclaimed[index++]]);
  };
}

/** Integer-like keys are enumerated first by JS, losing the select order. */
const INTEGER_KEY_RE = /^(?:0|[1-9]\d*)$/;

/** Fails when the keys left for positional matching are not in select order. */
function assertOrdered(keys: string[]): void {
  if (keys.length < 2) {
    return;
  }
  const reordered = keys.find((key) => INTEGER_KEY_RE.test(key));
  if (reordered !== undefined) {
    throw new Error(
      `[db0] [drizzle] cannot map query result: the driver named a selected expression \`${reordered}\`, ` +
        `and JavaScript enumerates such keys before all others, so the remaining expressions can no longer be told apart. ` +
        `Alias the expression (\`sql\`...\`.as("name")\`) so it can be matched by name.`,
    );
  }
}

/** Fails on selected fields that the driver returns under a single key. */
function assertUnambiguous(fields: Fields, keys: (string | undefined)[]): void {
  const owners = new Map<string, string>();
  for (const [index, key] of keys.entries()) {
    if (key === undefined) {
      continue;
    }
    const identity = getIdentity(fields[index].field);
    const owner = owners.get(key);
    if (owner === undefined) {
      owners.set(key, identity);
    } else if (owner !== identity) {
      throw new Error(
        `[db0] [drizzle] cannot map query result: \`${owner}\` and \`${identity}\` both come back as \`${key}\`. ` +
          `db0 connectors return object rows, so same-named columns collapse into one value. ` +
          `Select them with unique aliases (\`sql\`\${table.column}\`.as("alias")\`) or use the relational query builder (\`db.query.*\`).`,
      );
    }
  }
}

/**
 * Whether drizzle may compile its row mappers with `new Function()`, mirroring
 * the check its own drivers run: opting in is useless in an environment that
 * forbids it (a CSP without `unsafe-eval`, some edge runtimes), and drizzle
 * falls back to the premade mappers when this is `false`.
 */
export function useJitMappers(enabled: boolean | undefined): boolean {
  if (!enabled) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new-func
    return new Function("input", '"use strict"; return input;')(true) === true;
  } catch {
    return false;
  }
}
