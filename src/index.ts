export * from "./db";
export * from "./types";

export const connectors = {
  sqlite: "sql0/connectors/better-sqlite3",
} as const;

export type ConnectorName = keyof typeof connectors;
