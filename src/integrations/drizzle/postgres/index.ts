import type { Database } from "db0";
import { DB0PgSession, type DB0PgSessionOptions } from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import { PgDatabase, PgDialect } from "drizzle-orm/pg-core";

import {
  type DrizzleConfig as DrizzleBaseConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm";

import type { DB0PgQueryResultHKT } from "./_session.ts";

export type DrizzlePgDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = PgDatabase<DB0PgQueryResultHKT, TSchema>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: Database,
  config?: DrizzleBaseConfig<TSchema>,
): DrizzlePgDatabase<TSchema> {
  const dialect = new PgDialect({ casing: config?.casing });

  let logger: DB0PgSessionOptions["logger"];
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

  const session = new DB0PgSession(db, dialect, schema, {
    logger,
  });

  return new PgDatabase(
    dialect,
    session,
    schema as any,
  ) as DrizzlePgDatabase<TSchema>;
}
