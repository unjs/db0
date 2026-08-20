import type { DatabaseCapabilities, SQLDialect } from "./types.ts";

const sqlite: DatabaseCapabilities = Object.freeze({
  json: true,
  booleans: false,
  arrays: false,
  dates: false,
  uuids: false,
  transactions: true,
});

const postgresql: DatabaseCapabilities = Object.freeze({
  json: true,
  booleans: true,
  arrays: true,
  dates: true,
  uuids: true,
  transactions: true,
});

const mysql: DatabaseCapabilities = Object.freeze({
  json: true,
  booleans: true,
  arrays: false,
  dates: true,
  uuids: false,
  transactions: true,
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
