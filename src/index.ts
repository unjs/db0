export * from "./database";
export * from "./types";

export * from "./schema";

export const connectors = {
  sqlite: "db0/connectors/better-sqlite3",
  libsql: "db0/connectors/libsql",
  postgresql: "db0/connectors/postgresql",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
} as const;

export type ConnectorName = keyof typeof connectors;
