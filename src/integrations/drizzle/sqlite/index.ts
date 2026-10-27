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

import { bufferFromBytes } from "drizzle-orm/sqlite-core/codecs";
import type { SQLiteCodecs } from "drizzle-orm/sqlite-core/codecs";
import { refineCodecs } from "drizzle-orm/codecs";
import { betterSQLite3Codecs } from "drizzle-orm/better-sqlite3/codecs";
import { nodeSQLiteCodecs } from "drizzle-orm/node-sqlite/codecs";
import { libsqlCodecs } from "drizzle-orm/libsql/codecs";
import { d1Codecs } from "drizzle-orm/d1/codecs";

import {
  assertNoCasingOption,
  attachCache,
  trackSelectedFields,
  useJitMappers,
} from "../_utils.ts";

export type { DrizzleSQLiteConfig };

// Codecs
//
// Since drizzle-orm 1.0.0-rc.5, SQLite column decoding lives in codecs too (see
// `../postgres/index.ts`): a dialect built without them leaves booleans as
// `0`/`1`, timestamps as numbers, JSON as text and `numeric()` as whatever
// SQLite's affinity made of it. Every official driver passes the set matching
// its client, so db0 picks one per connector. Unlike Postgres, SQLite drivers
// need no reconfiguring for these, so the driver sets apply unchanged.

/**
 * Codecs for the connectors named `sqlite`: better-sqlite3 (blobs come back as
 * a `Buffer`) and bun:sqlite (a plain `Uint8Array`, which drizzle's bun driver
 * wraps in a `Buffer`) share that name, so blobs are wrapped only when needed.
 */
export const db0SQLiteCodecs: SQLiteCodecs = refineCodecs(betterSQLite3Codecs, {
  blob: {
    normalize: (value: Uint8Array) =>
      Buffer.isBuffer(value) ? value : bufferFromBytes(value),
  },
});

/**
 * The codecs db0 uses for a SQLite connector when `config.codecs` is unset.
 *
 * Unknown connectors (and `sqlite3`) fall back to the better-sqlite3 set. Pass
 * `codecs` explicitly for a client that decodes differently.
 */
export function sqliteCodecsFor(connector: string | undefined): SQLiteCodecs {
  if (connector?.startsWith("libsql")) {
    return libsqlCodecs;
  }
  switch (connector) {
    case "cloudflare-d1": {
      return d1Codecs;
    }
    case "node-sqlite": {
      return nodeSQLiteCodecs;
    }
    default: {
      return db0SQLiteCodecs;
    }
  }
}

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
    new SQLiteDialect({
      useJitMappers: useJitMappers(config?.jit),
      codecs: config?.codecs ?? sqliteCodecsFor(db.connector),
    }),
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
    paramsInErrors: config?.paramsInErrors,
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
