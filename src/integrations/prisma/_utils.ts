import type { SQLDialect } from "../../types.ts";
import type {
  ArgType,
  ColumnType,
  Provider,
  SqlQuery,
} from "@prisma/driver-adapter-utils";

export type ColumnTypeName =
  | "Int32"
  | "Int64"
  | "Float"
  | "Double"
  | "Numeric"
  | "Boolean"
  | "Text"
  | "DateTime"
  | "Json"
  | "Bytes"
  | "UnknownNumber";

/**
 * Mirror of `ColumnTypeEnum` from `@prisma/driver-adapter-utils`.
 *
 * These values are part of the driver adapter wire protocol. They are inlined
 * because `@prisma/driver-adapter-utils` is not installed by Prisma users (it
 * is a dependency of the official adapters only) and db0 ships no runtime
 * dependencies. Values stay type-checked against the real `ColumnType` union,
 * and `prisma.test.ts` asserts they match the upstream enum.
 */
export const columnTypes: Record<ColumnTypeName, ColumnType> = {
  Int32: 0,
  Int64: 1,
  Float: 2,
  Double: 3,
  Numeric: 4,
  Boolean: 5,
  Text: 7,
  DateTime: 10,
  Json: 11,
  Bytes: 13,
  UnknownNumber: 128,
};

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

export const getProviderFromDialect = (dialect: SQLDialect): Provider => {
  switch (dialect) {
    case "postgresql": {
      return "postgres";
    }
    case "libsql": {
      return "sqlite";
    }
    default: {
      return dialect;
    }
  }
};

/**
 * db0 statements return plain rows without type metadata, so the column type
 * reported back to Prisma is inferred from the first non-null value of each
 * column. Columns that are `null` for every row are reported as
 * `UnknownNumber`, which the query engine coerces to the field type.
 */
export const inferColumnType = (value: unknown): ColumnType => {
  switch (typeof value) {
    case "bigint": {
      return columnTypes.Int64;
    }
    case "boolean": {
      return columnTypes.Boolean;
    }
    case "number": {
      return Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX
        ? columnTypes.Int32
        : columnTypes.Double;
    }
    case "string": {
      return columnTypes.Text;
    }
    case "object": {
      if (value instanceof Date) {
        return columnTypes.DateTime;
      }
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return columnTypes.Bytes;
      }
      return columnTypes.Json;
    }
    default: {
      return columnTypes.UnknownNumber;
    }
  }
};

/**
 * Converts a set of db0 rows into the column-oriented shape Prisma expects.
 */
export const toResultSet = (
  rows: unknown[],
): {
  columnNames: string[];
  columnTypes: ColumnType[];
  rows: unknown[][];
} => {
  const columnNames = Object.keys((rows[0] as object) || {});
  const values = rows.map((row) =>
    columnNames.map((name) => (row as Record<string, unknown>)[name]),
  );
  return {
    columnNames,
    columnTypes: columnNames.map((_name, index) => {
      const row = values.find((value) => value[index] != null);
      return row === undefined
        ? columnTypes.UnknownNumber
        : inferColumnType(row[index]);
    }),
    rows: values,
  };
};

const decodeBase64 = (value: string): Uint8Array => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64");
  }
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.codePointAt(0)!);
};

/**
 * Converts the arguments Prisma binds to values the underlying driver accepts.
 *
 * Prisma hands over rich JS values (`boolean`, `Date`, base64 encoded bytes)
 * that SQLite drivers reject outright, so they are normalized per dialect.
 */
export const getQueryArgs = (
  query: SqlQuery,
  dialect: SQLDialect,
): unknown[] => {
  const isSqlite = dialect === "sqlite" || dialect === "libsql";

  return (query.args || []).map((arg, index) => {
    if (arg === null || arg === undefined) {
      return null;
    }

    const scalarType: ArgType["scalarType"] =
      query.argTypes?.[index]?.scalarType ?? "unknown";

    if (typeof arg === "string") {
      switch (scalarType) {
        case "int": {
          return Number.parseInt(arg, 10);
        }
        // `decimal` can lose precision here, but no supported driver has a
        // native decimal type.
        case "decimal":
        case "float": {
          return Number.parseFloat(arg);
        }
        case "bigint": {
          return BigInt(arg);
        }
        case "bytes": {
          return decodeBase64(arg);
        }
        case "datetime": {
          return isSqlite ? arg : new Date(arg);
        }
        default: {
          return arg;
        }
      }
    }

    if (typeof arg === "boolean") {
      // SQLite has no native boolean type
      return isSqlite ? (arg ? 1 : 0) : arg;
    }

    if (arg instanceof Date) {
      return isSqlite ? arg.toISOString() : arg;
    }

    return arg;
  });
};

/**
 * Number of rows affected by a write, normalized across connectors: each
 * driver reports it under a different key.
 */
export const getAffectedRows = (result: unknown): number => {
  const res = result as Record<string, unknown> | null;
  if (!res) {
    return 0;
  }
  const count =
    res.changes ??
    res.rowCount ??
    res.affectedRows ??
    res.rowsAffected ??
    (res.meta as Record<string, unknown> | undefined)?.changes;
  return typeof count === "bigint" ? Number(count) : (count as number) || 0;
};
