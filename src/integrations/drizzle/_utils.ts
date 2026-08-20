import {
  Column,
  SQL,
  Subquery,
  getColumnTable,
  getTableName,
  getTableUniqueName,
  is,
} from "drizzle-orm";
import type { AnyColumn, Table } from "drizzle-orm";
import type { SelectedFieldsOrdered } from "drizzle-orm/operations";
import type { Cache } from "drizzle-orm/cache/core";

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
// The name a field comes back under is the driver's, not drizzle's: a dialect
// may wrap a column in an unaliased cast (`cast("amount" as text)` for SQLite
// numerics, `"n"::text` for some postgres codecs), which renames it. The plan is
// therefore built against a real row (see `createRowConverter()`) and a computed
// key only counts when that row carries it; anything else is matched by
// position, in select order, against the row keys no field claimed.
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
 * the relational query builder, all of which emit unique keys, but not
 * necessarily in select order: drizzle appends relational extras after the
 * columns, so an extra named like an array index would be enumerated first.
 */
const byInsertionOrder: RowConverter = (row) => {
  const keys = Object.keys(row);
  assertOrdered(keys);
  return keys.map((key) => row[key]);
};

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
 *
 * The mapper is wrapped because drizzle applies it to the converted rows of
 * every execution, an empty result included, which is the only hook this module
 * has to reject a query no row can prove wrong (see `assertAliasesUnambiguous`).
 */
export function trackSelectedFields<
  TDialect extends { readonly mapperGenerators: MapperGenerators },
>(dialect: TDialect): TDialect {
  const generators = dialect.mapperGenerators;
  const generateRows = generators.rows;
  generators.rows = (columns, joinsNotNullableMap) => {
    const mapper = generateRows(columns, joinsNotNullableMap);
    let checked = false;
    const checkedMapper: Mapper = (rows) => {
      if (!checked) {
        assertAliasesUnambiguous(columns);
        checked = true;
      }
      return mapper(rows);
    };
    converters.set(checkedMapper, createRowConverter(columns));
    return checkedMapper;
  };
  return dialect;
}

/**
 * Row key a field is named after, or `undefined` when the driver names it after
 * the raw expression text (bare, non-aliased SQL) and it has to be resolved
 * positionally. A key is a candidate only — a dialect may cast the field and
 * rename it in the process, so the plan checks it against the row.
 */
function getKey(field: Field): string | undefined {
  if (is(field, Column)) {
    return field.name;
  }
  if (is(field, SQL.Aliased)) {
    return field.fieldAlias;
  }
  if (is(field, Subquery)) {
    // Emitted as `(select ...) "alias"`, so the driver names it after the alias.
    return field._.alias;
  }
  return undefined;
}

/** Whether the driver names a field after an alias drizzle always emits. */
function isAliasKeyed(field: Field): boolean {
  return is(field, SQL.Aliased) || is(field, Subquery);
}

/** Stable ids for expressions, to tell two objects sharing an alias apart. */
const expressionIds = new WeakMap<object, number>();
let lastExpressionId = 0;

function expressionId(expression: object): number {
  let id = expressionIds.get(expression);
  if (id === undefined) {
    expressionIds.set(expression, (id = ++lastExpressionId));
  }
  return id;
}

/**
 * Identifies the value behind a key, to detect fields that collapse into one.
 *
 * Two aliased fields are the same value only when they are the same expression:
 * an alias on its own is reused by drizzle (`subquery.column` builds a fresh
 * `SQL.Aliased` around the same `SQL` on every access) but is also what two
 * unrelated expressions collide on.
 */
function getIdentity(field: Field): string {
  if (is(field, Column)) {
    // The unique name, so that same-named tables of two schemas stay apart.
    return `${getTableUniqueName(getColumnTable(field))}.${field.name}`;
  }
  if (is(field, Subquery)) {
    return `subquery.${field._.alias}#${expressionId(field._.sql)}`;
  }
  const aliased = field as SQL.Aliased;
  return `alias.${aliased.fieldAlias}#${expressionId(aliased.sql)}`;
}

/** How a field is named in the error messages below. */
function getLabel(field: Field, path: string[]): string {
  if (is(field, Column)) {
    return `${getTableLabel(getColumnTable(field))}.${field.name}`;
  }
  if (is(field, Subquery)) {
    return `${path.join(".")} (subquery "${field._.alias}")`;
  }
  return `${path.join(".")} (aliased as "${(field as SQL.Aliased).fieldAlias}")`;
}

/** The table name, qualified only when the table declares a schema. */
function getTableLabel(table: Table): string {
  const name = getTableName(table);
  const uniqueName = getTableUniqueName(table);
  return uniqueName === `public.${name}` ? name : uniqueName;
}

/**
 * Builds the object row -> select-order array conversion for `fields`, on the
 * first row it is asked to convert: the row is what tells the plan which keys
 * the driver really used, and the checks below reject queries db0 cannot map.
 * A session runs the conversion from inside its executor, so they surface as a
 * rejected query rather than as a throw from the query builder.
 */
function createRowConverter(fields: Fields): RowConverter {
  let convert: RowConverter | undefined;
  return (row) => (convert ??= planRowConverter(fields, row))(row);
}

function planRowConverter(
  fields: Fields,
  row: Record<string, unknown>,
): RowConverter {
  // Own keys only: a driver that could not store a column (a `__proto__` alias
  // on a plain object) must not resolve to a value off the prototype chain.
  const rowKeys = Object.keys(row);
  const named = new Set(rowKeys);
  const keys = fields.map(({ field }) => {
    const key = getKey(field);
    return key !== undefined && named.has(key) ? key : undefined;
  });
  assertUnambiguous(fields, keys);

  if (keys.every((key) => key !== undefined)) {
    return (row) => keys.map((key) => row[key!]);
  }

  // Fields the driver did not name after a key of their own — bare SQL, and
  // columns a dialect renamed by casting them — get the row keys no other field
  // claimed, in select order. Resolving them here rather than per row keeps the
  // conversion a plain lookup.
  const claimed = new Set(keys.filter((key) => key !== undefined));
  const unclaimed = rowKeys.filter((key) => !claimed.has(key));
  assertMatched(fields, keys, unclaimed);
  assertOrdered(unclaimed);

  let index = 0;
  const resolved = keys.map((key) => key ?? unclaimed[index++]);
  return (row) => resolved.map((key) => row[key]);
}

/**
 * Integer-like keys are enumerated first by JS, losing the select order — but
 * only the ones that are array indices, so anything above the largest index is
 * an ordinary string key.
 */
const ARRAY_INDEX_KEY_RE = /^(?:0|[1-9]\d{0,9})$/;

function isArrayIndexKey(key: string): boolean {
  const first = key.charCodeAt(0);
  if (first < 48 /* 0 */ || first > 57 /* 9 */) {
    // Fast path: this runs per row for the mappers built without a field list.
    return false;
  }
  return ARRAY_INDEX_KEY_RE.test(key) && Number(key) < 2 ** 32 - 1;
}

/** Fails when the keys left for positional matching are not in select order. */
function assertOrdered(keys: string[]): void {
  if (keys.length < 2) {
    return;
  }
  const reordered = keys.find((key) => isArrayIndexKey(key));
  if (reordered !== undefined) {
    throw new Error(
      `[db0] [drizzle] cannot map query result: the driver named a selected expression \`${reordered}\`, ` +
        `and JavaScript enumerates such keys before all others, so the remaining expressions can no longer be told apart. ` +
        `Alias the expression (\`sql\`...\`.as("name")\`) so it can be matched by name.`,
    );
  }
}

/** Fails when positional matching cannot give every field a key of its own. */
function assertMatched(
  fields: Fields,
  keys: (string | undefined)[],
  unclaimed: string[],
): void {
  const unmatched = fields.filter((_, index) => keys[index] === undefined);
  if (unmatched.length === unclaimed.length) {
    return;
  }
  const labels = unmatched
    .map(({ path }) => `\`${path.join(".")}\``)
    .join(", ");
  throw new Error(
    `[db0] [drizzle] cannot map query result: the driver returned ${unclaimed.length} column(s) no selected field is named after, ` +
      `for the ${unmatched.length} selected expression(s) ${labels} that have to be matched by position. ` +
      `db0 connectors return object rows, so identically named expressions collapse into one value. ` +
      `Select them with unique aliases (\`sql\`...\`.as("alias")\`) so they can be matched by name.`,
  );
}

/** Fails on selected fields that the driver returns under a single key. */
function assertUnambiguous(fields: Fields, keys: (string | undefined)[]): void {
  const owners = new Map<string, { identity: string; label: string }>();
  for (const [index, key] of keys.entries()) {
    if (key === undefined) {
      continue;
    }
    const { field, path } = fields[index];
    const identity = getIdentity(field);
    const owner = owners.get(key);
    if (owner === undefined) {
      owners.set(key, { identity, label: getLabel(field, path) });
    } else if (owner.identity !== identity) {
      throw new Error(
        `[db0] [drizzle] cannot map query result: \`${owner.label}\` and \`${getLabel(field, path)}\` both come back as \`${key}\`. ` +
          `db0 connectors return object rows, so same-named columns collapse into one value. ` +
          `Select them with unique aliases (\`sql\`\${table.column}\`.as("alias")\`) or use the relational query builder (\`db.query.*\`).`,
      );
    }
  }
}

/**
 * The part of `assertUnambiguous()` that holds without a row, so that a query
 * whose result is empty is rejected too: drizzle always emits an alias verbatim
 * (`... as "x"`, `(select ...) "x"`), so two aliased fields sharing one alias
 * always collapse. Column names are checked against the row instead, because a
 * dialect may rename a column by casting it and so keep the two apart.
 */
function assertAliasesUnambiguous(fields: Fields): void {
  const aliased = fields.filter(({ field }) => isAliasKeyed(field));
  assertUnambiguous(
    aliased,
    aliased.map(({ field }) => getKey(field)),
  );
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

/**
 * `casing` was removed from drizzle's config in v1 and is only rejected by
 * TypeScript for inline object literals, so a config built in a variable or
 * forwarded by a framework wrapper would silently generate the wrong SQL.
 */
export function assertNoCasingOption(config: unknown): void {
  if (config && typeof config === "object" && "casing" in config) {
    throw new Error(
      "[db0] [drizzle] The `casing` option was removed in drizzle-orm v1. Apply `snakeCase.table()` / `camelCase.table()` (from `drizzle-orm`) to your schema instead.",
    );
  }
}

/**
 * Wires drizzle's manual cache-invalidation API the way every official driver
 * does: `db.$cache` becomes the configured cache with its `invalidate` hook
 * pointing at `onMutate`.
 *
 * Unlike the official drivers we leave drizzle's built-in no-op `$cache` in
 * place when no cache is configured, rather than replacing it with `undefined`.
 */
export function attachCache(
  db: { $cache: { invalidate: Cache["onMutate"] } },
  cache: Cache | undefined,
): void {
  if (!cache) {
    return;
  }
  const $cache = cache as unknown as { invalidate: Cache["onMutate"] };
  $cache.invalidate = cache.onMutate;
  db.$cache = $cache;
}
