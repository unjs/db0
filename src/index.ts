export * from "./db";
export * from "./types";

export const connectors = {
  sqlite: "sql0/connectors/better-sqlite3",
  postgresql: "sql0/connectors/postgresql",
} as const;

export type ConnectorName = keyof typeof connectors;
