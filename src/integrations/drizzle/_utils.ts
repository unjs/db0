import { is, Column, SQL } from "drizzle-orm";
import type { SelectedFieldsOrdered } from "drizzle-orm/operations";

export function rowToArray(
  fields: SelectedFieldsOrdered<Column>,
  row: Record<string, unknown>,
): unknown[] {
  return fields.map(({ field }) => {
    if (is(field, Column)) return row[field.name];
    if (is(field, SQL.Aliased)) return row[field.fieldAlias];
    return undefined;
  });
}

export function mapRow(
  fields: SelectedFieldsOrdered<Column>,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const { path, field } of fields) {
    let rawValue: unknown;
    if (is(field, Column)) {
      rawValue = row[field.name];
    } else if (is(field, SQL.Aliased)) {
      rawValue = row[field.fieldAlias];
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
