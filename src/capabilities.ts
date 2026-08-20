import type { DatabaseCapabilities, SQLDialect } from "./types.ts";

const sqlite: DatabaseCapabilities = Object.freeze({
  supportsJSON: true,
  supportsBooleans: false,
  supportsArrays: false,
  supportsDates: false,
  supportsUUIDs: false,
  supportsTransactions: true,
});

const postgresql: DatabaseCapabilities = Object.freeze({
  supportsJSON: true,
  supportsBooleans: true,
  supportsArrays: true,
  supportsDates: true,
  supportsUUIDs: true,
  supportsTransactions: true,
});

const mysql: DatabaseCapabilities = Object.freeze({
  supportsJSON: true,
  supportsBooleans: true,
  supportsArrays: false,
  supportsDates: true,
  supportsUUIDs: false,
  supportsTransactions: true,
});

export const dialectCapabilities: Record<SQLDialect, DatabaseCapabilities> =
  Object.freeze({
    sqlite,
    libsql: sqlite,
    postgresql,
    mysql,
  });

export function getCapabilities(
  dialect: SQLDialect,
  overrides?: Partial<DatabaseCapabilities>,
): DatabaseCapabilities {
  return overrides
    ? Object.freeze({ ...dialectCapabilities[dialect], ...overrides })
    : dialectCapabilities[dialect];
}
