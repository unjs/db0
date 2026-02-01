import type { DatabaseCapabilities, SQLDialect } from "./types.ts";

const sqlite: DatabaseCapabilities = {
  supportsJSON: true,
  supportsBooleans: false,
  supportsArrays: false,
  supportsDates: false,
  supportsUUIDs: false,
  supportsTransactions: true,
  supportsBatch: true,
};

const postgresql: DatabaseCapabilities = {
  supportsJSON: true,
  supportsBooleans: true,
  supportsArrays: true,
  supportsDates: true,
  supportsUUIDs: true,
  supportsTransactions: true,
  supportsBatch: true,
};

const mysql: DatabaseCapabilities = {
  supportsJSON: true,
  supportsBooleans: true,
  supportsArrays: false,
  supportsDates: true,
  supportsUUIDs: false,
  supportsTransactions: true,
  supportsBatch: true,
};

export const dialectCapabilities: Record<SQLDialect, DatabaseCapabilities> = {
  sqlite,
  libsql: sqlite,
  postgresql,
  mysql,
};

export function getCapabilities(
  dialect: SQLDialect,
  overrides?: Partial<DatabaseCapabilities>,
): DatabaseCapabilities {
  return overrides
    ? { ...dialectCapabilities[dialect], ...overrides }
    : dialectCapabilities[dialect];
}

export type { DatabaseCapabilities } from "./types.ts";
