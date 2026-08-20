import type { Database } from "db0";
import { DB0PgSession, type DB0PgSessionOptions } from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import { PgAsyncDatabase, PgDialect } from "drizzle-orm/pg-core";

import type { DrizzlePgConfig } from "drizzle-orm/pg-core";

import type { AnyRelations, EmptyRelations } from "drizzle-orm";

import { trackSelectedFields, useJitMappers } from "../_utils.ts";

import type { DB0PgQueryResultHKT } from "./_session.ts";

export type DrizzlePgDatabase<
  TRelations extends AnyRelations = EmptyRelations,
> = PgAsyncDatabase<DB0PgQueryResultHKT, TRelations>;

export function drizzle<TRelations extends AnyRelations = EmptyRelations>(
  db: Database,
  config?: DrizzlePgConfig<TRelations>,
): DrizzlePgDatabase<TRelations> {
  const dialect = trackSelectedFields(
    new PgDialect({
      useJitMappers: useJitMappers(config?.jit),
      codecs: config?.codecs,
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

  return new PgAsyncDatabase(dialect, session, relations);
}
