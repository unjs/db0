import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  type SQL,
  NoopLogger,
  fillPlaceholders,
  sql,
} from "drizzle-orm";

import { RowMapper, getCasing, mapRows } from "../_utils.ts";

import {
  MySqlDialect,
  MySqlSession,
  MySqlPreparedQuery,
  MySqlTransaction,
} from "drizzle-orm/mysql-core";

import type {
  MySqlPreparedQueryConfig,
  MySqlPreparedQueryHKT,
  MySqlQueryResultHKT,
  MySqlTransactionConfig,
  PreparedQueryKind,
  SelectedFieldsOrdered,
  Mode,
} from "drizzle-orm/mysql-core";

import type { CasingCache } from "drizzle-orm/casing";

import type { Database } from "db0";

export interface DB0MySqlSessionOptions {
  logger?: Logger;
}

type Assume<T, U> = T extends U ? T : U;

export interface DB0MySqlQueryResultHKT extends MySqlQueryResultHKT {
  type: Assume<
    this["row"],
    {
      [column: string]: any;
    }
  >[];
}

export interface DB0MySqlPreparedQueryHKT extends MySqlPreparedQueryHKT {
  type: DB0MySqlPreparedQuery<Assume<this["config"], MySqlPreparedQueryConfig>>;
}

export class DB0MySqlSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends MySqlSession<
  DB0MySqlQueryResultHKT,
  DB0MySqlPreparedQueryHKT,
  TFullSchema,
  TSchema
> {
  private logger: Logger;

  constructor(
    private db: Database,
    dialect: MySqlDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private mode: Mode,
    options: DB0MySqlSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<T extends MySqlPreparedQueryConfig>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    customResultMapper?: (rows: unknown[][]) => T["execute"],
    _generatedIds?: Record<string, unknown>[],
    _returningIds?: SelectedFieldsOrdered,
  ): PreparedQueryKind<DB0MySqlPreparedQueryHKT, T> {
    return new DB0MySqlPreparedQuery(
      this.db,
      query.sql,
      query.params,
      this.logger,
      fields,
      customResultMapper,
      getCasing(this.dialect),
    ) as PreparedQueryKind<DB0MySqlPreparedQueryHKT, T>;
  }

  override async all<T = unknown>(query: SQL): Promise<T[]> {
    const builtQuery = this.dialect.sqlToQuery(query);
    const prepared = this.prepareQuery(builtQuery, undefined);
    return prepared.execute() as Promise<T[]>;
  }

  // drizzle's mysql session reads `res[0][0]`, the `[rows, fields]` tuple the
  // mysql2 driver returns; db0 hands back the rows on their own.
  override async count(query: SQL): Promise<number> {
    const res = await this.execute<{ count: string | number }[]>(query);
    return Number(res[0]["count"]);
  }

  override async transaction<T>(
    transaction: (tx: DB0MySqlTransaction<TFullSchema, TSchema>) => Promise<T>,
    config?: MySqlTransactionConfig,
  ): Promise<T> {
    const tx = new DB0MySqlTransaction<TFullSchema, TSchema>(
      this.dialect,
      this as MySqlSession<any, any, any, any>,
      this.schema,
      0,
      this.mode,
    );
    if (config) {
      const setTransactionConfigSql = this.getSetTransactionSQL(config);
      if (setTransactionConfigSql) {
        await tx.execute(setTransactionConfigSql);
      }
      const startTransactionSql = this.getStartTransactionSQL(config);
      await (startTransactionSql
        ? tx.execute(startTransactionSql)
        : tx.execute(sql`begin`));
    } else {
      await tx.execute(sql`begin`);
    }
    try {
      const result = await transaction(tx);
      await tx.execute(sql`commit`);
      return result;
    } catch (error) {
      await tx.execute(sql`rollback`);
      throw error;
    }
  }
}

export class DB0MySqlTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends MySqlTransaction<
  DB0MySqlQueryResultHKT,
  DB0MySqlPreparedQueryHKT,
  TFullSchema,
  TSchema
> {
  override async transaction<T>(
    transaction: (tx: DB0MySqlTransaction<TFullSchema, TSchema>) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new DB0MySqlTransaction<TFullSchema, TSchema>(
      // @ts-expect-error -- accessing inherited property
      this.dialect,
      // @ts-expect-error -- accessing inherited property
      this.session,
      this.schema,
      this.nestedIndex + 1,
      this.mode,
    );
    await tx.execute(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await tx.execute(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (error_) {
      await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
      throw error_;
    }
  }
}

export class DB0MySqlPreparedQuery<
  T extends MySqlPreparedQueryConfig = MySqlPreparedQueryConfig,
> extends MySqlPreparedQuery<T> {
  /** @internal assigned by drizzle's select builder after construction */
  declare joinsNotNullableMap: Record<string, boolean> | undefined;

  private mapper: RowMapper;

  constructor(
    private db: Database,
    private queryString: string,
    private params: unknown[],
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    private customResultMapper?: (rows: unknown[][]) => T["execute"],
    casing?: CasingCache,
  ) {
    super(undefined, undefined);
    this.mapper = new RowMapper(fields, casing);
  }

  async execute(
    placeholderValues: Record<string, unknown> | undefined = {},
  ): Promise<T["execute"]> {
    const params: any[] = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.queryString, params);

    const stmt = this.db.prepare(this.queryString);

    if (!this.fields && !this.customResultMapper) {
      return stmt.all(...params);
    }

    const rows = (await stmt.all(...params)) as Record<string, unknown>[];

    return mapRows(
      rows,
      this.mapper,
      this.customResultMapper,
      this.joinsNotNullableMap,
    ) as T["execute"];
  }

  // eslint-disable-next-line require-yield
  async *iterator(): AsyncGenerator<T["iterator"]> {
    throw new Error("Streaming is not supported by the db0 MySQL driver");
  }
}
