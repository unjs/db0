export * from "./db";
export * from "./types";

export const connectors = {
  sqlite: "db0/connectors/better-sqlite3",
  postgresql: "db0/connectors/postgresql",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
} as const;

export type ConnectorName = keyof typeof connectors;
