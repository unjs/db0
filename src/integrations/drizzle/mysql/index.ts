import type { Database } from "db0";
import { DB0MySqlSession, type DB0MySqlSessionOptions } from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import { MySqlAsyncDatabase, MySqlDialect } from "drizzle-orm/mysql-core";

import type { DrizzleMySqlConfig } from "drizzle-orm/mysql-core";

import type { AnyRelations, EmptyRelations } from "drizzle-orm";

import { trackSelectedFields, useJitMappers } from "../_utils.ts";

import type { DB0MySqlQueryResultHKT } from "./_session.ts";

export type DrizzleMySqlDatabase<
  TRelations extends AnyRelations = EmptyRelations,
> = MySqlAsyncDatabase<DB0MySqlQueryResultHKT, TRelations>;

export function drizzle<TRelations extends AnyRelations = EmptyRelations>(
  db: Database,
  config?: DrizzleMySqlConfig<TRelations>,
): DrizzleMySqlDatabase<TRelations> {
  const dialect = trackSelectedFields(
    new MySqlDialect({
      useJitMappers: useJitMappers(config?.jit),
      codecs: config?.codecs,
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

  return new MySqlAsyncDatabase(dialect, session, relations);
}
