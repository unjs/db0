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

import { trackSelectedFields, useJitMappers } from "../_utils.ts";

export type DrizzleSQLiteDatabase<
  TRelations extends AnyRelations = EmptyRelations,
> = SQLiteAsyncDatabase<"async", DB0SQLiteRunResult, TRelations>;

export function drizzle<TRelations extends AnyRelations = EmptyRelations>(
  db: Database,
  config?: DrizzleSQLiteConfig<TRelations>,
): DrizzleSQLiteDatabase<TRelations> {
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

  return new SQLiteAsyncDatabase("async", dialect, session, relations);
}
