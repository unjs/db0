import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  NoopLogger,
  fillPlaceholders,
  sql,
} from "drizzle-orm";

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

import type { SQL } from "drizzle-orm";

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
  type: DB0MySqlPreparedQuery<
    Assume<this["config"], MySqlPreparedQueryConfig>
  >;
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
    ) as PreparedQueryKind<DB0MySqlPreparedQueryHKT, T>;
  }

  override async all<T = unknown>(query: SQL): Promise<T[]> {
    const builtQuery = this.dialect.sqlToQuery(query);
    const prepared = this.prepareQuery(builtQuery, undefined);
    return prepared.execute() as Promise<T[]>;
  }

  override async transaction<T>(
    transaction: (
      tx: DB0MySqlTransaction<TFullSchema, TSchema>,
    ) => Promise<T>,
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
    transaction: (
      tx: DB0MySqlTransaction<TFullSchema, TSchema>,
    ) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new DB0MySqlTransaction<TFullSchema, TSchema>(
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1,
      // @ts-expect-error -- accessing inherited property
      this.mode,
    );
    await tx.execute(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await tx.execute(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (err) {
      await tx.execute(sql.raw(`rollback to savepoint ${savepointName}`));
      throw err;
    }
  }
}

export class DB0MySqlPreparedQuery<
  T extends MySqlPreparedQueryConfig = MySqlPreparedQueryConfig,
> extends MySqlPreparedQuery<T> {
  constructor(
    private db: Database,
    private queryString: string,
    private params: unknown[],
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    private customResultMapper?: (rows: unknown[][]) => T["execute"],
  ) {
    super(undefined, undefined);
  }

  async execute(
    placeholderValues: Record<string, unknown> | undefined = {},
  ): Promise<T["execute"]> {
    const params = fillPlaceholders(this.params, placeholderValues);
    this.logger.logQuery(this.queryString, params);

    const stmt = this.db.prepare(this.queryString);

    if (!this.fields && !this.customResultMapper) {
      return stmt.all(...(params as any[]));
    }

    const rows = await stmt.all(...(params as any[]));

    if (this.customResultMapper) {
      return this.customResultMapper(rows as unknown[][]);
    }

    // db0 returns object rows, return as-is when fields are present
    return rows as T["execute"];
  }

  async *iterator(): AsyncGenerator<T["iterator"]> {
    throw new Error("Streaming is not supported by the db0 MySQL driver");
  }
}
