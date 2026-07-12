import { is, Column, SQL } from "drizzle-orm";
import type { SelectedFieldsOrdered } from "drizzle-orm/operations";

// Note: db0 connectors always return object rows keyed by the driver's column
// name. Queries selecting two columns with the same name (e.g. `users.id` and
// `posts.id` in a join) therefore collapse to a single key and cannot be
// disambiguated at this layer — a driver-level array/raw row mode would be
// required. Drizzle's relational query builder avoids this by emitting unique
// aliases, so relational queries are unaffected.

export function rowToArray(
  fields: SelectedFieldsOrdered<Column> | undefined,
  row: Record<string, unknown>,
): unknown[] {
  // The relational query builder passes no `fields` alongside its
  // `customResultMapper`; db0 rows are objects, so hand back the values in
  // SELECT order (object key insertion order matches the generated SQL).
  if (!fields) {
    return Object.values(row);
  }
  const values = Object.values(row);
  return fields.map(({ field }, index) => {
    if (is(field, Column)) return row[field.name];
    if (is(field, SQL.Aliased)) return row[field.fieldAlias];
    // Bare (non-aliased) SQL expression: db0 keys it by the raw expression text
    // (e.g. `count(*)`), so fall back to positional lookup — object key order
    // matches the SELECT order.
    return values[index];
  });
}

export function mapRow(
  fields: SelectedFieldsOrdered<Column>,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const values = Object.values(row);
  for (const [index, { path, field }] of fields.entries()) {
    let rawValue: unknown;
    if (is(field, Column)) {
      rawValue = row[field.name];
    } else if (is(field, SQL.Aliased)) {
      rawValue = row[field.fieldAlias];
    } else {
      // Bare SQL expression: db0 keys it by the raw expression text, so fall
      // back to positional lookup (object key order matches SELECT order).
      rawValue = values[index];
    }
    let value: unknown;
    if (rawValue == null) {
      value = null;
    } else if (is(field, Column)) {
      value = field.mapFromDriverValue(rawValue);
    } else {
      value = rawValue;
    }
    let node = result;
    for (const [i, chunk] of path.entries()) {
      if (i < path.length - 1) {
        node = (node[chunk] as Record<string, unknown>) ??= {};
      } else {
        node[chunk] = value;
      }
    }
  }
  return result;
}
