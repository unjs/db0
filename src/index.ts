export * from "./database";
export * from "./types";

/**
 * A mapping of available database connector identifiers to their module paths.
 * This constant facilitates the use of different database connectors by providing easy access to the
 * by providing easy access to the connector's specific import paths.
 */
export const connectors = {
  sqlite: "db0/connectors/better-sqlite3",
  postgresql: "db0/connectors/postgresql",
  pglite: "db0/connectors/pglite",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
  libsql: "db0/connectors/libsql/node",
  "libsql-node": "db0/connectors/libsql/node",
  "libsql-http": "db0/connectors/libsql/http",
  "libsql-web": "db0/connectors/libsql/web",
  bun: "db0/connectors/bun-sqlite",
  "bun-sqlite": "db0/connectors/bun-sqlite",
  planetscale: "db0/connectors/planetscale",
} as const;

/**
 * Type alias for the keys of the {@link connectors} map.
 * Represents the names of available database connectors.
 */
export type ConnectorName = keyof typeof connectors;
