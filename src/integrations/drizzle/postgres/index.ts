import type { Database } from "db0";
import { DB0PgSession, type DB0PgSessionOptions } from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import { PgAsyncDatabase, PgDialect } from "drizzle-orm/pg-core";

import type { DrizzlePgConfig } from "drizzle-orm/pg-core";

import type { AnyRelations, EmptyRelations } from "drizzle-orm";

import { refineCodecs } from "drizzle-orm/codecs";
import { castToText } from "drizzle-orm/pg-core/codecs";
import type { PgCodecs } from "drizzle-orm/pg-core/codecs";
import { nodePgCodecs } from "drizzle-orm/node-postgres/codecs";
import { pgliteCodecs } from "drizzle-orm/pglite/codecs";
import { neonServerlessCodecs } from "drizzle-orm/neon-serverless/codecs";

import {
  assertNoCasingOption,
  attachCache,
  trackSelectedFields,
  useJitMappers,
} from "../_utils.ts";

import type { DB0PgQueryResultHKT } from "./_session.ts";

export type { DrizzlePgConfig };

// Codecs
//
// drizzle v1 moved all column decoding out of the column classes and into
// codecs, so a dialect built without them (`noopCodecs`) returns whatever the
// driver produced: `numeric({ mode: "number" })` stays a string, `bigint()`
// stays whatever the driver guessed, and nothing matches `$inferSelect`. Every
// official driver therefore passes the codec set matching its client, and db0
// has to do the same — per connector, since db0 sits on several clients.
//
// One thing db0 cannot copy from those drivers: they also reconfigure the
// connection so their codecs receive raw text for date/time types
// (`node-postgres/session.ts` replaces the `pg` type parsers for
// TIMESTAMP/TIMESTAMPTZ/DATE/INTERVAL with a no-op, `pglite/session.ts` passes
// the same set as `parsers`). db0's connectors hand drizzle the driver's
// default output, which is an already-parsed `Date` (or, for `pg`, an interval
// object) built with the driver's own timezone assumptions — the exact input
// `textToDateWithTz()` and the `:string` modes cannot handle.
//
// So we ask Postgres for the text instead of the driver: `x::text` is
// byte-identical to the wire text format for these types and, unlike a function
// call, leaves the result column name untouched, which db0's object rows are
// keyed by. The driver codec sets below then apply unchanged.
const PG_DATE_TIME_AS_TEXT: PgCodecs = {
  date: { cast: castToText },
  "date:string": { cast: castToText },
  interval: { cast: castToText },
  timestamp: { cast: castToText },
  "timestamp:string": { cast: castToText },
  timestamptz: { cast: castToText },
  "timestamptz:string": { cast: castToText },
};

/** `drizzle-orm/node-postgres` codecs, adjusted for db0's `pg` connectors. */
export const db0NodePgCodecs: PgCodecs = refineCodecs(
  nodePgCodecs,
  PG_DATE_TIME_AS_TEXT,
);

/** `drizzle-orm/pglite` codecs, adjusted for db0's `pglite` connector. */
export const db0PgliteCodecs: PgCodecs = refineCodecs(
  pgliteCodecs,
  PG_DATE_TIME_AS_TEXT,
);

/** `drizzle-orm/neon-serverless` codecs, adjusted for db0's `neon` connector. */
export const db0NeonCodecs: PgCodecs = refineCodecs(
  neonServerlessCodecs,
  PG_DATE_TIME_AS_TEXT,
);

/**
 * The codecs db0 uses for a Postgres connector when `config.codecs` is unset.
 *
 * Unknown connectors fall back to the `pg` set: every db0 Postgres connector
 * that is not PGlite or Neon speaks to a plain `pg` client. Pass `codecs`
 * explicitly for a client that decodes differently.
 */
export function pgCodecsFor(connector: string | undefined): PgCodecs {
  switch (connector) {
    case "pglite": {
      return db0PgliteCodecs;
    }
    case "neon": {
      return db0NeonCodecs;
    }
    default: {
      return db0NodePgCodecs;
    }
  }
}

export type DrizzlePgDatabase<
  TRelations extends AnyRelations = EmptyRelations,
> = PgAsyncDatabase<DB0PgQueryResultHKT, TRelations> & {
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
  config?: DrizzlePgConfig<TRelations>,
): DrizzlePgDatabase<TRelations> {
  assertNoCasingOption(config);

  const dialect = trackSelectedFields(
    new PgDialect({
      useJitMappers: useJitMappers(config?.jit),
      codecs: config?.codecs ?? pgCodecsFor(db.connector),
    }),
  );

  let logger: DB0PgSessionOptions["logger"];
  if (config?.logger === true) {
    logger = new DefaultLogger();
  } else if (config?.logger !== false && config?.logger !== undefined) {
    logger = config.logger;
  }

  const relations = (config?.relations ?? {}) as TRelations;

  const session = new DB0PgSession(db, dialect, relations, {
    logger,
    cache: config?.cache,
  });

  const drizzleDb = new PgAsyncDatabase(
    dialect,
    session,
    relations,
  ) as DrizzlePgDatabase<TRelations>;

  drizzleDb.$client = db;
  attachCache(drizzleDb, config?.cache);

  return drizzleDb;
}
