// Auto-generated using scripts/gen-connectors.
// Do not manually edit!
import type { ConnectorOptions as BetterSqlite3Options } from "db0/connectors/better-sqlite3";
import type { ConnectorOptions as BunOptions } from "db0/connectors/bun-sqlite";
import type { ConnectorOptions as CloudflareD1Options } from "db0/connectors/cloudflare-d1";
import type { ConnectorOptions as LibsqlCoreOptions } from "db0/connectors/libsql/core";
import type { ConnectorOptions as LibsqlHttpOptions } from "db0/connectors/libsql/http";
import type { ConnectorOptions as LibsqlOptions } from "db0/connectors/libsql/node";
import type { ConnectorOptions as LibsqlWebOptions } from "db0/connectors/libsql/web";
import type { ConnectorOptions as Mysql2Options } from "db0/connectors/mysql2";
import type { ConnectorOptions as PgliteOptions } from "db0/connectors/pglite";
import type { ConnectorOptions as PlanetscaleOptions } from "db0/connectors/planetscale";
import type { ConnectorOptions as PostgresqlOptions } from "db0/connectors/postgresql";
export type BuiltinConnectorName = "better-sqlite3" | "betterSqlite3" | "bun-sqlite" | "bun" | "cloudflare-d1" | "cloudflareD1" | "libsql-core" | "libsqlCore" | "libsql-http" | "libsqlHttp" | "libsql-node" | "libsql" | "libsql-web" | "libsqlWeb" | "mysql2" | "pglite" | "planetscale" | "postgresql";
export type BuiltinConnectorOptions = {
  "better-sqlite3": BetterSqlite3Options;
  "betterSqlite3": BetterSqlite3Options;
  "bun-sqlite": BunOptions;
  "bun": BunOptions;
  "cloudflare-d1": CloudflareD1Options;
  "cloudflareD1": CloudflareD1Options;
  "libsql-core": LibsqlCoreOptions;
  "libsqlCore": LibsqlCoreOptions;
  "libsql-http": LibsqlHttpOptions;
  "libsqlHttp": LibsqlHttpOptions;
  "libsql-node": LibsqlOptions;
  "libsql": LibsqlOptions;
  "libsql-web": LibsqlWebOptions;
  "libsqlWeb": LibsqlWebOptions;
  "mysql2": Mysql2Options;
  "pglite": PgliteOptions;
  "planetscale": PlanetscaleOptions;
  "postgresql": PostgresqlOptions;
};
export const builtinConnectors = {
  "better-sqlite3": "db0/connectors/better-sqlite3",
  "betterSqlite3": "db0/connectors/better-sqlite3",
  "bun-sqlite": "db0/connectors/bun-sqlite",
  "bun": "db0/connectors/bun-sqlite",
  "cloudflare-d1": "db0/connectors/cloudflare-d1",
  "cloudflareD1": "db0/connectors/cloudflare-d1",
  "libsql-core": "db0/connectors/libsql/core",
  "libsqlCore": "db0/connectors/libsql/core",
  "libsql-http": "db0/connectors/libsql/http",
  "libsqlHttp": "db0/connectors/libsql/http",
  "libsql-node": "db0/connectors/libsql/node",
  "libsql": "db0/connectors/libsql/node",
  "libsql-web": "db0/connectors/libsql/web",
  "libsqlWeb": "db0/connectors/libsql/web",
  "mysql2": "db0/connectors/mysql2",
  "pglite": "db0/connectors/pglite",
  "planetscale": "db0/connectors/planetscale",
  "postgresql": "db0/connectors/postgresql",
} as const;
