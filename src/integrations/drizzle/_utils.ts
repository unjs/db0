import { Column, SQL, Subquery, getTableName, is } from "drizzle-orm";
import type { CasingCache } from "drizzle-orm/casing";
import type { SelectedFieldsOrdered } from "drizzle-orm/operations";

// Note: db0 connectors always return object rows keyed by the driver's column
// name, so every selected field has to be looked up by name instead of by
// position. Fields that the driver cannot key uniquely (two same-named columns
// from different tables in a join) are rejected upfront by `RowMapper` — see
// `assertUnambiguous()` — because there is no way to tell the two values apart
// at this layer. Drizzle's relational query builder emits unique aliases, so
// relational queries are unaffected.

type Decoder = { mapFromDriverValue: (value: unknown) => unknown };

type Field = SelectedFieldsOrdered<Column>[number]["field"];

const identityDecoder: Decoder = { mapFromDriverValue: (value) => value };

/**
 * The casing cache the dialect used to build the query, so column names are
 * resolved exactly the way they were emitted (`casing: "snake_case"` renames
 * columns declared without an explicit name).
 */
export function getCasing(dialect: unknown): CasingCache | undefined {
  return (dialect as { casing?: CasingCache } | undefined)?.casing;
}

/**
 * Mirrors the decoder lookup of drizzle's own `mapResultRow`, so `mapWith()`,
 * `$type()` and the built-in column decoders keep working. `decoder` is
 * `@internal` in drizzle's types, hence the casts.
 */
function getDecoder(field: Field): Decoder {
  if (is(field, Column)) {
    return field;
  }
  if (is(field, SQL)) {
    return (
      (field as unknown as { decoder?: Decoder }).decoder ?? identityDecoder
    );
  }
  const sql = is(field, Subquery)
    ? (field as unknown as { _: { sql: SQL } })._.sql
    : (field as SQL.Aliased).sql;
  return (sql as unknown as { decoder?: Decoder }).decoder ?? identityDecoder;
}

/**
 * Row key a field is returned under, or `undefined` when the driver names it
 * after the raw expression text (bare, non-aliased SQL) and it has to be
 * resolved positionally.
 */
function getKey(
  field: Field,
  casing: CasingCache | undefined,
): string | undefined {
  if (is(field, Column)) {
    return casing ? casing.getColumnCasing(field) : field.name;
  }
  if (is(field, SQL.Aliased)) {
    return field.fieldAlias;
  }
  return undefined;
}

/** Identifies the value behind a key, to detect fields that collapse into one. */
function getIdentity(field: Field): string {
  return is(field, Column)
    ? `${getTableName(field.table)}.${field.name}`
    : `alias.${(field as SQL.Aliased).fieldAlias}`;
}

interface FieldPlan {
  path: string[];
  key: string | undefined;
  decoder: Decoder;
  /** Set for columns only, used to null out unmatched left joins. */
  tableName: string | undefined;
}

/**
 * Maps the object rows db0 connectors return onto the shape drizzle expects,
 * either as a positional array (for drizzle's own result mappers) or as the
 * nested object of a select.
 */
export class RowMapper {
  #fields: SelectedFieldsOrdered<Column> | undefined;
  #casing: CasingCache | undefined;
  #plan: FieldPlan[] | undefined;

  constructor(
    fields: SelectedFieldsOrdered<Column> | undefined,
    casing?: CasingCache,
  ) {
    this.#fields = fields;
    this.#casing = casing;
  }

  #getPlan(): FieldPlan[] {
    if (!this.#plan) {
      const fields = this.#fields!;
      this.#plan = fields.map(({ path, field }) => ({
        path: path as string[],
        key: getKey(field, this.#casing),
        decoder: getDecoder(field),
        tableName: is(field, Column) ? getTableName(field.table) : undefined,
      }));
      assertUnambiguous(fields, this.#plan);
    }
    return this.#plan;
  }

  /**
   * Keys to read each field from. Fields the driver keys by expression text get
   * the row keys no other field claimed, in select order.
   */
  #resolveKeys(
    plan: FieldPlan[],
    row: Record<string, unknown>,
  ): (string | undefined)[] {
    if (plan.every((entry) => entry.key !== undefined)) {
      return plan.map((entry) => entry.key);
    }
    const claimed = new Set(
      plan.map((entry) => entry.key).filter((key) => key !== undefined),
    );
    const unclaimed = Object.keys(row).filter((key) => !claimed.has(key));
    assertOrdered(unclaimed);
    let index = 0;
    return plan.map((entry) => entry.key ?? unclaimed[index++]);
  }

  /** Values in select order, undecoded, as drizzle's result mappers expect. */
  toArray(row: Record<string, unknown>): unknown[] {
    // The relational query builder passes no `fields` alongside its
    // `customResultMapper`; db0 rows are objects, so hand back the values in
    // SELECT order (object key insertion order matches the generated SQL).
    if (!this.#fields) {
      return Object.values(row);
    }
    const plan = this.#getPlan();
    return this.#resolveKeys(plan, row).map((key) =>
      key === undefined ? undefined : row[key],
    );
  }

  /** Decoded, nested object row — the drizzle equivalent is `mapResultRow()`. */
  toObject(
    row: Record<string, unknown>,
    joinsNotNullableMap?: Record<string, boolean>,
  ): Record<string, unknown> {
    const plan = this.#getPlan();
    const keys = this.#resolveKeys(plan, row);
    const result: Record<string, unknown> = {};
    // Table name per nested object as long as all of its columns are null.
    const nullifyMap: Record<string, string | false> = {};

    for (const [index, { path, decoder, tableName }] of plan.entries()) {
      const key = keys[index];
      const rawValue = key === undefined ? undefined : row[key];
      const value =
        rawValue == null ? null : decoder.mapFromDriverValue(rawValue);

      let node = result;
      for (const [i, chunk] of path.entries()) {
        if (i < path.length - 1) {
          node = (node[chunk] as Record<string, unknown>) ??= {};
        } else {
          node[chunk] = value;
        }
      }

      if (joinsNotNullableMap && tableName !== undefined && path.length === 2) {
        const objectName = path[0];
        if (objectName in nullifyMap) {
          if (nullifyMap[objectName] !== tableName) {
            nullifyMap[objectName] = false;
          }
        } else {
          nullifyMap[objectName] = value === null ? tableName : false;
        }
      }
    }

    if (joinsNotNullableMap) {
      for (const [objectName, tableName] of Object.entries(nullifyMap)) {
        if (tableName !== false && !joinsNotNullableMap[tableName]) {
          result[objectName] = null;
        }
      }
    }

    return result;
  }
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
function assertUnambiguous(
  fields: SelectedFieldsOrdered<Column>,
  plan: FieldPlan[],
): void {
  const owners = new Map<string, string>();
  for (const [index, { key }] of plan.entries()) {
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

/** Applies drizzle's result mapper, or maps the rows onto the selected fields. */
export function mapRows(
  rows: Record<string, unknown>[],
  mapper: RowMapper,
  customResultMapper: ((rows: unknown[][]) => unknown) | undefined,
  joinsNotNullableMap: Record<string, boolean> | undefined,
): unknown {
  return customResultMapper
    ? customResultMapper(rows.map((row) => mapper.toArray(row)) as unknown[][])
    : rows.map((row) => mapper.toObject(row, joinsNotNullableMap));
}
