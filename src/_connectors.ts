// Auto-generated using scripts/gen-connectors.
// Do not manually edit!
import type { ConnectorDependencies } from "./types.ts";
import type { ConnectorOptions as BetterSQLite3Options } from "db0/connectors/better-sqlite3";
import type { ConnectorOptions as BunSQLiteOptions } from "db0/connectors/bun-sqlite";
import type { ConnectorOptions as CloudflareD1Options } from "db0/connectors/cloudflare-d1";
import type { ConnectorOptions as CloudflareHyperdriveMySQLOptions } from "db0/connectors/cloudflare-hyperdrive-mysql";
import type { ConnectorOptions as CloudflareHyperdrivePostgreSQLOptions } from "db0/connectors/cloudflare-hyperdrive-postgresql";
import type { ConnectorOptions as LibSQLCoreOptions } from "db0/connectors/libsql/core";
import type { ConnectorOptions as LibSQLHttpOptions } from "db0/connectors/libsql/http";
import type { ConnectorOptions as LibSQLNodeOptions } from "db0/connectors/libsql/node";
import type { ConnectorOptions as LibSQLWebOptions } from "db0/connectors/libsql/web";
import type { ConnectorOptions as MySQL2Options } from "db0/connectors/mysql2";
import type { ConnectorOptions as NeonOptions } from "db0/connectors/neon";
import type { ConnectorOptions as NeonInstantOptions } from "db0/connectors/neon-instant";
import type { ConnectorOptions as NodeSQLiteOptions } from "db0/connectors/node-sqlite";
import type { ConnectorOptions as PgliteOptions } from "db0/connectors/pglite";
import type { ConnectorOptions as PlanetscaleOptions } from "db0/connectors/planetscale";
import type { ConnectorOptions as PostgreSQLOptions } from "db0/connectors/postgresql";
import type { ConnectorOptions as SQLite3Options } from "db0/connectors/sqlite3";

export type ConnectorName = "better-sqlite3" | "bun-sqlite" | "bun" | "cloudflare-d1" | "cloudflare-hyperdrive-mysql" | "cloudflare-hyperdrive-postgresql" | "libsql-core" | "libsql-http" | "libsql-node" | "libsql" | "libsql-web" | "mysql2" | "neon" | "neon-instant" | "node-sqlite" | "sqlite" | "pglite" | "planetscale" | "postgresql" | "sqlite3";

export type ConnectorOptions = {
  "better-sqlite3": BetterSQLite3Options;
  "bun-sqlite": BunSQLiteOptions;
  /** alias of bun-sqlite */
  "bun": BunSQLiteOptions;
  "cloudflare-d1": CloudflareD1Options;
  "cloudflare-hyperdrive-mysql": CloudflareHyperdriveMySQLOptions;
  "cloudflare-hyperdrive-postgresql": CloudflareHyperdrivePostgreSQLOptions;
  "libsql-core": LibSQLCoreOptions;
  "libsql-http": LibSQLHttpOptions;
  "libsql-node": LibSQLNodeOptions;
  /** alias of libsql-node */
  "libsql": LibSQLNodeOptions;
  "libsql-web": LibSQLWebOptions;
  "mysql2": MySQL2Options;
  "neon": NeonOptions;
  "neon-instant": NeonInstantOptions;
  "node-sqlite": NodeSQLiteOptions;
  /** alias of node-sqlite */
  "sqlite": NodeSQLiteOptions;
  "pglite": PgliteOptions;
  "planetscale": PlanetscaleOptions;
  "postgresql": PostgreSQLOptions;
  "sqlite3": SQLite3Options;
};

export const connectors: Record<ConnectorName, string> = Object.freeze({
  "better-sqlite3": "db0/connectors/better-sqlite3",
  "bun-sqlite": "db0/connectors/bun-sqlite",
  /** alias of bun-sqlite */
  "bun": "db0/connectors/bun-sqlite",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
  "cloudflare-hyperdrive-mysql": "db0/connectors/cloudflare-hyperdrive-mysql",
  "cloudflare-hyperdrive-postgresql": "db0/connectors/cloudflare-hyperdrive-postgresql",
  "libsql-core": "db0/connectors/libsql/core",
  "libsql-http": "db0/connectors/libsql/http",
  "libsql-node": "db0/connectors/libsql/node",
  /** alias of libsql-node */
  "libsql": "db0/connectors/libsql/node",
  "libsql-web": "db0/connectors/libsql/web",
  "mysql2": "db0/connectors/mysql2",
  "neon": "db0/connectors/neon",
  "neon-instant": "db0/connectors/neon-instant",
  "node-sqlite": "db0/connectors/node-sqlite",
  /** alias of node-sqlite */
  "sqlite": "db0/connectors/node-sqlite",
  "pglite": "db0/connectors/pglite",
  "planetscale": "db0/connectors/planetscale",
  "postgresql": "db0/connectors/postgresql",
  "sqlite3": "db0/connectors/sqlite3",
} as const);

/**
 * Third-party packages each connector dynamically imports, keyed by the connector option
 * that can be used to provide them (usually `lib`).
 *
 * Connectors not listed here have no third-party dependencies.
 */
export const connectorDependencies: Partial<
  Record<ConnectorName, ConnectorDependencies>
> = Object.freeze({
  "better-sqlite3": {
    lib: { name: "better-sqlite3", version: "^11 || ^12 || ^13" },
  },
  "cloudflare-hyperdrive-mysql": {
    lib: { name: "mysql2", version: "^3" },
  },
  "cloudflare-hyperdrive-postgresql": {
    lib: { name: "pg", version: "^8" },
  },
  "libsql-http": {
    lib: { name: "@libsql/client", version: "^0.14 || ^0.15 || ^0.16 || ^0.17" },
  },
  "libsql-node": {
    lib: { name: "@libsql/client", version: "^0.14 || ^0.15 || ^0.16 || ^0.17" },
  },
  /** alias of libsql-node */
  "libsql": {
    lib: { name: "@libsql/client", version: "^0.14 || ^0.15 || ^0.16 || ^0.17" },
  },
  "libsql-web": {
    lib: { name: "@libsql/client", version: "^0.14 || ^0.15 || ^0.16 || ^0.17" },
  },
  "mysql2": {
    lib: { name: "mysql2", version: "^3" },
  },
  "neon": {
    lib: { name: "@neondatabase/serverless", version: "^1" },
  },
  "neon-instant": {
    lib: { name: "@neondatabase/serverless", version: "^1" },
    provisionLib: { name: "neon-new", version: "^0.15", optional: true },
  },
  "pglite": {
    lib: { name: "@electric-sql/pglite", version: "^0.3 || ^0.4 || ^0.5" },
  },
  "planetscale": {
    lib: { name: "@planetscale/database", version: "^1" },
  },
  "postgresql": {
    lib: { name: "pg", version: "^8" },
  },
  "sqlite3": {
    lib: { name: "sqlite3", version: "^5 || ^6" },
  },
} as const);
