import type { Database } from "db0";
import {
  DB0SQLiteSession,
  type DB0SQLiteRunResult,
  type DB0SQLiteSessionOptions,
} from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import { SQLiteAsyncDatabase, SQLiteDialect } from "drizzle-orm/sqlite-core";

import type { DrizzleSQLiteConfig } from "drizzle-orm/sqlite-core";

import type { AnyRelations, EmptyRelations } from "drizzle-orm";

import {
  assertNoCasingOption,
  attachCache,
  trackSelectedFields,
  useJitMappers,
} from "../_utils.ts";

export type { DrizzleSQLiteConfig };

/**
 * Connectors whose SQLite build predates JSONB (SQLite 3.45).
 *
 * Cloudflare D1 is the one db0 ships; drizzle's own `d1` and `durable-sqlite`
 * drivers hardcode `forbidJsonb: true` for the same reason.
 */
const NO_JSONB_CONNECTORS: ReadonlySet<string> = new Set(["cloudflare-d1"]);

export type DB0DrizzleSQLiteConfig<
  TRelations extends AnyRelations = EmptyRelations,
> = DrizzleSQLiteConfig<TRelations> & {
  /**
   * Make the relational query builder emit `json_*` helpers instead of
   * `jsonb_*`, for SQLite builds without JSONB support (added in SQLite 3.45).
   *
   * Defaults to `true` for the `cloudflare-d1` connector and `false` otherwise.
   */
  forbidJsonb?: boolean | undefined;
};

export type DrizzleSQLiteDatabase<
  TRelations extends AnyRelations = EmptyRelations,
> = SQLiteAsyncDatabase<"async", DB0SQLiteRunResult, TRelations> & {
  /**
   * The db0 database this drizzle instance runs on.
   *
   * Drizzle drivers expose the underlying client as `$client`; db0's is the
   * `Database`, since the driver instance itself is only reachable
   * asynchronously through `db.getInstance()`.
   */
  $client: Database;
};

export function drizzle<TRelations extends AnyRelations = EmptyRelations>(
  db: Database,
  config?: DB0DrizzleSQLiteConfig<TRelations>,
): DrizzleSQLiteDatabase<TRelations> {
  assertNoCasingOption(config);

  const dialect = trackSelectedFields(
    new SQLiteDialect({ useJitMappers: useJitMappers(config?.jit) }),
  );

  let logger: DB0SQLiteSessionOptions["logger"];
  if (config?.logger === true) {
    logger = new DefaultLogger();
  } else if (config?.logger !== false && config?.logger !== undefined) {
    logger = config.logger;
  }

  const relations = (config?.relations ?? {}) as TRelations;

  const forbidJsonb =
    config?.forbidJsonb ?? NO_JSONB_CONNECTORS.has(db.connector);

  const session = new DB0SQLiteSession(db, dialect, relations, {
    logger,
    cache: config?.cache,
    // So that a transaction's relational queries emit the same JSON helpers.
    forbidJsonb,
  });

  const drizzleDb = new SQLiteAsyncDatabase(
    "async",
    dialect,
    session,
    relations,
    forbidJsonb,
  ) as DrizzleSQLiteDatabase<TRelations>;

  drizzleDb.$client = db;
  attachCache(drizzleDb, config?.cache);

  return drizzleDb;
}
