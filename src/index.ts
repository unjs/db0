export * from "./database";
export * from "./types";

export * from "./schema";

export const connectors = {
  sqlite: "db0/connectors/better-sqlite3",
  postgresql: "db0/connectors/postgresql",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
  libsql: "db0/connectors/libsql/node",
  "libsql-node": "db0/connectors/libsql/node",
  "libsql-http": "db0/connectors/libsql/http",
  "libsql-web": "db0/connectors/libsql/web",
} as const;

export type ConnectorName = keyof typeof connectors;
