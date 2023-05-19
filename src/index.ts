export * from "./db";
export * from "./types";

export const connectors = {
  sqlite: "db0/connectors/better-sqlite3",
  postgresql: "db0/connectors/postgresql",
} as const;

export type ConnectorName = keyof typeof connectors;
