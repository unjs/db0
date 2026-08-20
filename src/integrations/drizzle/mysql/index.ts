import type { Database } from "db0";
import { DB0MySqlSession, type DB0MySqlSessionOptions } from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import { MySqlAsyncDatabase, MySqlDialect } from "drizzle-orm/mysql-core";

import type { DrizzleMySqlConfig } from "drizzle-orm/mysql-core";

import type { AnyRelations, EmptyRelations } from "drizzle-orm";

import type { Cache } from "drizzle-orm/cache/core";

import { refineCodecs } from "drizzle-orm/codecs";
import { castToText } from "drizzle-orm/mysql-core/codecs";
import type { MySqlCodecs } from "drizzle-orm/mysql-core/codecs";
import { mysql2Codecs } from "drizzle-orm/mysql2/codecs";
import { planetscaleServerlessCodecs } from "drizzle-orm/planetscale-serverless/codecs";

import { trackSelectedFields, useJitMappers } from "../_utils.ts";

import type { DB0MySqlQueryResultHKT } from "./_session.ts";

export type { DrizzleMySqlConfig };

// Codecs
//
// drizzle v1 moved all column decoding out of the column classes and into
// codecs, so a dialect built without them (`noopCodecs`) returns whatever the
// driver produced: `boolean()` stays `1`, `bigint({ mode: "bigint" })` stays a
// number, and nothing matches `$inferSelect`. Every official driver therefore
// passes the codec set matching its client, and db0 has to do the same — per
// connector, since db0 sits on several clients.
//
// One thing db0 cannot copy from those drivers: `drizzle-orm/mysql2` also
// reconfigures the connection so its codecs receive raw text —
// `mysql2/session.ts` installs a `typeCast` that returns `field.string()` for
// DATE/DATETIME/TIMESTAMP, and `mysql2/driver.ts` sets
// `client.config.supportBigNumbers`. db0's connectors hand drizzle mysql2's
// default output instead: a `Date` parsed in the connection's timezone (which
// `datetime`'s `value.replace(" ", "T")` cannot even accept) and a BIGINT
// already rounded to a JS number.
//
// So we ask MySQL for the text instead of the driver: `cast(x as char)` yields
// exactly the string mysql2's `typeCast` would have produced, whatever the
// connection is configured with, and the driver codec sets below then apply
// unchanged. `serial` is deliberately left alone — its codecs differ per client
// and every client already returns it as a number.
const MYSQL_AS_TEXT: MySqlCodecs = {
  bigint: { cast: castToText },
  "bigint:number": { cast: castToText },
  "bigint:string": { cast: castToText },
  date: { cast: castToText },
  "date:string": { cast: castToText },
  datetime: { cast: castToText },
  "datetime:string": { cast: castToText },
  timestamp: { cast: castToText },
  "timestamp:string": { cast: castToText },
};

/** `drizzle-orm/mysql2` codecs, adjusted for db0's `mysql2` connectors. */
export const db0Mysql2Codecs: MySqlCodecs = refineCodecs(
  mysql2Codecs,
  MYSQL_AS_TEXT,
);

/**
 * `drizzle-orm/planetscale-serverless` codecs, adjusted for db0's `planetscale`
 * connector.
 */
export const db0PlanetscaleCodecs: MySqlCodecs = refineCodecs(
  planetscaleServerlessCodecs,
  MYSQL_AS_TEXT,
);

/**
 * The codecs db0 uses for a MySQL connector when `config.codecs` is unset.
 *
 * Unknown connectors fall back to the `mysql2` set: every db0 MySQL connector
 * that is not PlanetScale speaks to a `mysql2` client. Pass `codecs` explicitly
 * for a client that decodes differently.
 */
export function mysqlCodecsFor(connector: string | undefined): MySqlCodecs {
  switch (connector) {
    case "planetscale": {
      return db0PlanetscaleCodecs;
    }
    default: {
      return db0Mysql2Codecs;
    }
  }
}

export type DrizzleMySqlDatabase<
  TRelations extends AnyRelations = EmptyRelations,
> = MySqlAsyncDatabase<DB0MySqlQueryResultHKT, TRelations> & {
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
  config?: DrizzleMySqlConfig<TRelations>,
): DrizzleMySqlDatabase<TRelations> {
  assertNoCasingOption(config);

  const dialect = trackSelectedFields(
    new MySqlDialect({
      useJitMappers: useJitMappers(config?.jit),
      codecs: config?.codecs ?? mysqlCodecsFor(db.connector),
    }),
  );

  let logger: DB0MySqlSessionOptions["logger"];
  if (config?.logger === true) {
    logger = new DefaultLogger();
  } else if (config?.logger !== false && config?.logger !== undefined) {
    logger = config.logger;
  }

  const relations = (config?.relations ?? {}) as TRelations;

  const session = new DB0MySqlSession(db, dialect, relations, {
    logger,
    cache: config?.cache,
  });

  const drizzleDb = new MySqlAsyncDatabase(
    dialect,
    session,
    relations,
  ) as DrizzleMySqlDatabase<TRelations>;

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
