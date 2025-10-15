import { DefaultLogger } from "drizzle-orm/logger";
import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
} from "drizzle-orm/sqlite-core";
import type { DrizzleConfig as DrizzleBaseConfig } from "drizzle-orm";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
} from "drizzle-orm";
import type { Database } from "db0";
import { DB0Session, type DB0SessionOptions } from "./_session.ts";

export type DrizzleDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = BaseSQLiteDatabase<"async", any, TSchema>;

export type DrizzleConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = DrizzleBaseConfig<TSchema>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: Database, config?: DrizzleConfig<TSchema>): DrizzleDatabase<TSchema> {
  const dialect = new SQLiteAsyncDialect({ casing: config?.casing });

  let logger: DB0SessionOptions["logger"];
  if (config?.logger === true) {
    logger = new DefaultLogger();
  } else if (config?.logger !== false && config?.logger !== undefined) {
    logger = config.logger;
  }

  // Transform user schema to RelationalSchemaConfig
  // Reference: https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/d1/driver.ts
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

  const session = new DB0Session(db, dialect, schema, {
    logger,
  });

  return new BaseSQLiteDatabase(
    "async",
    dialect,
    // @ts-expect-error TODO

    session,
    schema,
  ) as DrizzleDatabase<TSchema>;
}
