import type { Database } from "db0";
import { DB0SQLiteSession, type DB0SQLiteSessionOptions } from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
} from "drizzle-orm/sqlite-core";

import {
  type DrizzleConfig as DrizzleBaseConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm";

export type DrizzleSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = BaseSQLiteDatabase<"async", any, TSchema>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: Database,
  config?: DrizzleBaseConfig<TSchema>,
): DrizzleSQLiteDatabase<TSchema> {
  const dialect = new SQLiteAsyncDialect({ casing: config?.casing });

  let logger: DB0SQLiteSessionOptions["logger"];
  if (config?.logger === true) {
    logger = new DefaultLogger();
  } else if (config?.logger !== false && config?.logger !== undefined) {
    logger = config.logger;
  }

  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
  if (config?.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers,
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }

  const session = new DB0SQLiteSession(db, dialect, schema, {
    logger,
  });

  return new BaseSQLiteDatabase(
    "async",
    dialect,
    session,
    schema,
  ) as DrizzleSQLiteDatabase<TSchema>;
}
