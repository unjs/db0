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

import type { Cache } from "drizzle-orm/cache/core";

import { trackSelectedFields, useJitMappers } from "../_utils.ts";

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

  const session = new DB0SQLiteSession(db, dialect, relations, {
    logger,
    cache: config?.cache,
  });

  const forbidJsonb =
    config?.forbidJsonb ?? NO_JSONB_CONNECTORS.has(db.connector);

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

/**
 * `casing` was removed from drizzle's config in v1 and is only rejected by
 * TypeScript for inline object literals, so a config built in a variable or
 * forwarded by a framework wrapper would silently generate the wrong SQL.
 */
function assertNoCasingOption(config: unknown): void {
  if (config && typeof config === "object" && "casing" in config) {
    throw new Error(
      "[db0] [drizzle] The `casing` option was removed in drizzle-orm v1. Apply `snakeCase.table()` / `camelCase.table()` (from `drizzle-orm`) to your schema instead.",
    );
  }
}

/**
 * Wires drizzle's manual cache-invalidation API the way every official driver
 * does: `db.$cache` becomes the configured cache with its `invalidate` hook
 * pointing at `onMutate`.
 *
 * Unlike the official drivers we leave drizzle's built-in no-op `$cache` in
 * place when no cache is configured, rather than replacing it with `undefined`.
 */
function attachCache(
  db: { $cache: { invalidate: Cache["onMutate"] } },
  cache: Cache | undefined,
): void {
  if (!cache) {
    return;
  }
  const $cache = cache as unknown as { invalidate: Cache["onMutate"] };
  $cache.invalidate = cache.onMutate;
  db.$cache = $cache;
}
