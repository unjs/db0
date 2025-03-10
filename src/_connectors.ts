// Auto-generated using scripts/gen-connectors.
// Do not manually edit!
import type { ConnectorOptions as BetterSQLite3Options } from "db0/connectors/better-sqlite3";
import type { ConnectorOptions as BunSQLiteOptions } from "db0/connectors/bun-sqlite";
import type { ConnectorOptions as CloudflareD1Options } from "db0/connectors/cloudflare-d1";
import type { ConnectorOptions as LibSQLCoreOptions } from "db0/connectors/libsql/core";
import type { ConnectorOptions as LibSQLHttpOptions } from "db0/connectors/libsql/http";
import type { ConnectorOptions as LibSQLNodeOptions } from "db0/connectors/libsql/node";
import type { ConnectorOptions as LibSQLWebOptions } from "db0/connectors/libsql/web";
import type { ConnectorOptions as MySQL2Options } from "db0/connectors/mysql2";
import type { ConnectorOptions as NodeSQLiteOptions } from "db0/connectors/node-sqlite";
import type { ConnectorOptions as PgliteOptions } from "db0/connectors/pglite";
import type { ConnectorOptions as PlanetscaleOptions } from "db0/connectors/planetscale";
import type { ConnectorOptions as PostgreSQLOptions } from "db0/connectors/postgresql";
import type { ConnectorOptions as SQLite3Options } from "db0/connectors/sqlite3";

export type ConnectorName = "better-sqlite3" | "bun-sqlite" | "bun" | "cloudflare-d1" | "libsql-core" | "libsql-http" | "libsql-node" | "libsql" | "libsql-web" | "mysql2" | "node-sqlite" | "sqlite" | "pglite" | "planetscale" | "postgresql" | "sqlite3";

export type ConnectorOptions = {
  "better-sqlite3": BetterSQLite3Options;
  "bun-sqlite": BunSQLiteOptions;
  /** alias of bun-sqlite */
  "bun": BunSQLiteOptions;
  "cloudflare-d1": CloudflareD1Options;
  "libsql-core": LibSQLCoreOptions;
  "libsql-http": LibSQLHttpOptions;
  "libsql-node": LibSQLNodeOptions;
  /** alias of libsql-node */
  "libsql": LibSQLNodeOptions;
  "libsql-web": LibSQLWebOptions;
  "mysql2": MySQL2Options;
  "node-sqlite": NodeSQLiteOptions;
  /** alias of node-sqlite */
  "sqlite": NodeSQLiteOptions;
  "pglite": PgliteOptions;
  "planetscale": PlanetscaleOptions;
  "postgresql": PostgreSQLOptions;
  "sqlite3": SQLite3Options;
};

export const connectors = Object.freeze({
  "better-sqlite3": "db0/connectors/better-sqlite3",
  "bun-sqlite": "db0/connectors/bun-sqlite",
  /** alias of bun-sqlite */
  "bun": "db0/connectors/bun-sqlite",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
  "libsql-core": "db0/connectors/libsql/core",
  "libsql-http": "db0/connectors/libsql/http",
  "libsql-node": "db0/connectors/libsql/node",
  /** alias of libsql-node */
  "libsql": "db0/connectors/libsql/node",
  "libsql-web": "db0/connectors/libsql/web",
  "mysql2": "db0/connectors/mysql2",
  "node-sqlite": "db0/connectors/node-sqlite",
  /** alias of node-sqlite */
  "sqlite": "db0/connectors/node-sqlite",
  "pglite": "db0/connectors/pglite",
  "planetscale": "db0/connectors/planetscale",
  "postgresql": "db0/connectors/postgresql",
  "sqlite3": "db0/connectors/sqlite3",
} as const);
