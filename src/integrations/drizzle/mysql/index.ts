import type { Database } from "db0";
import { DB0MySqlSession, type DB0MySqlSessionOptions } from "./_session.ts";

import { DefaultLogger } from "drizzle-orm/logger";

import { MySqlDatabase, MySqlDialect } from "drizzle-orm/mysql-core";

import type { Mode } from "drizzle-orm/mysql-core";

import {
  type DrizzleConfig as DrizzleBaseConfig,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm";

import type {
  DB0MySqlQueryResultHKT,
  DB0MySqlPreparedQueryHKT,
} from "./_session.ts";

export type DrizzleMySqlDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = MySqlDatabase<DB0MySqlQueryResultHKT, DB0MySqlPreparedQueryHKT, TSchema>;

export interface DrizzleMySqlConfig<
  TSchema extends Record<string, unknown> = Record<string, never>,
> extends DrizzleBaseConfig<TSchema> {
  mode?: Mode;
}

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  db: Database,
  config?: DrizzleMySqlConfig<TSchema>,
): DrizzleMySqlDatabase<TSchema> {
  const dialect = new MySqlDialect({ casing: config?.casing });
  const mode: Mode = config?.mode ?? "default";

  let logger: DB0MySqlSessionOptions["logger"];
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

  const session = new DB0MySqlSession(db, dialect, schema, mode, {
    logger,
  });

  return new MySqlDatabase(
    dialect,
    session,
    schema as any,
    mode,
  ) as DrizzleMySqlDatabase<TSchema>;
}
