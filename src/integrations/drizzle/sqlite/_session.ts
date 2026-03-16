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
  SQLiteAsyncDialect,
  SQLiteSession,
  SQLitePreparedQuery,
  SQLiteTransaction,
} from "drizzle-orm/sqlite-core";

import type {
  PreparedQueryConfig,
  SelectedFieldsOrdered,
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core";

import type { Database, Statement } from "db0";

export interface DB0SQLiteSessionOptions {
  logger?: Logger;
}

export class DB0SQLiteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteSession<"async", unknown, TFullSchema, TSchema> {
  declare dialect: SQLiteAsyncDialect;

  private logger: Logger;

  constructor(
    private db: Database,
    dialect: SQLiteAsyncDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    options: DB0SQLiteSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    _isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown,
  ): DB0SQLitePreparedQuery {
    const stmt = this.db.prepare(query.sql);
    return new DB0SQLitePreparedQuery(
      stmt,
      query,
      this.logger,
      fields,
      executeMethod,
      customResultMapper,
    );
  }

  override async transaction<T>(
    transaction: (tx: DB0SQLiteTransaction<TFullSchema, TSchema>) => Promise<T>,
    config?: SQLiteTransactionConfig,
  ): Promise<T> {
    const tx = new DB0SQLiteTransaction<TFullSchema, TSchema>(
      "async",
      this.dialect,
      this,
      this.schema,
    );
    await this.run(
      sql.raw(`begin${config?.behavior ? " " + config.behavior : ""}`),
    );
    try {
      const result = await transaction(tx);
      await this.run(sql`commit`);
      return result;
    } catch (err) {
      await this.run(sql`rollback`);
      throw err;
    }
  }
}

export class DB0SQLiteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteTransaction<"async", unknown, TFullSchema, TSchema> {
  override async transaction<T>(
    transaction: (
      tx: DB0SQLiteTransaction<TFullSchema, TSchema>,
    ) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new DB0SQLiteTransaction<TFullSchema, TSchema>(
      "async",
      // @ts-expect-error -- accessing inherited property
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1,
    );
    // @ts-expect-error -- accessing inherited property
    await this.session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      // @ts-expect-error -- accessing inherited property
      await this.session.run(
        sql.raw(`release savepoint ${savepointName}`),
      );
      return result;
    } catch (err) {
      // @ts-expect-error -- accessing inherited property
      await this.session.run(
        sql.raw(`rollback to savepoint ${savepointName}`),
      );
      throw err;
    }
  }
}

export class DB0SQLitePreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig,
> extends SQLitePreparedQuery<{
  type: "async";
  run: Awaited<ReturnType<Statement["run"]>>;
  all: T["all"];
  get: T["get"];
  values: T["values"];
  execute: T["execute"];
}> {
  constructor(
    private stmt: Statement,
    query: Query,
    private logger: Logger,
    _fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    /** @internal */ public customResultMapper?: (
      rows: unknown[][],
    ) => unknown,
  ) {
    super("async", executeMethod, query);
  }

  async run(
    placeholderValues?: Record<string, unknown>,
  ): Promise<{ success: boolean }> {
    const params = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {},
    );
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.run(...(params as any[]));
  }

  async all(placeholderValues?: Record<string, unknown>): Promise<T["all"]> {
    const params = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {},
    );
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.all(...(params as any[]));
  }

  async get(placeholderValues?: Record<string, unknown>): Promise<T["get"]> {
    const params = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {},
    );
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.get(...(params as any[]));
  }

  async values<T extends any[] = unknown[]>(
    placeholderValues?: Record<string, unknown>,
  ): Promise<T[]> {
    const params = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {},
    );
    this.logger.logQuery(this.query.sql, params);
    const rows = await this.stmt.all(...(params as any[]));
    // db0 Statement doesn't have a values() method, so convert object rows to arrays
    return (rows as Record<string, unknown>[]).map(
      (row) => Object.values(row) as T,
    );
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    // db0 always returns object rows, never array rows
    return false;
  }
}
