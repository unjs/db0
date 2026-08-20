import {
  type Logger,
  type RelationalSchemaConfig,
  type Query,
  type TablesRelationalConfig,
  NoopLogger,
  fillPlaceholders,
  sql,
} from "drizzle-orm";

import { RowMapper, getCasing, mapRows } from "../_utils.ts";

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

import type { CasingCache } from "drizzle-orm/casing";

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
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown,
  ): DB0SQLitePreparedQuery {
    const stmt = this.db.prepare(query.sql);
    return new DB0SQLitePreparedQuery(
      stmt,
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper,
      getCasing(this.dialect),
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
    } catch (error_) {
      await this.run(sql`rollback`);
      throw error_;
    }
  }
}

export class DB0SQLiteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteTransaction<"async", unknown, TFullSchema, TSchema> {
  override async transaction<T>(
    transaction: (tx: DB0SQLiteTransaction<TFullSchema, TSchema>) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex}`;
    const tx = new DB0SQLiteTransaction<TFullSchema, TSchema>(
      "async",
      // @ts-expect-error -- accessing inherited property
      this.dialect,
      // @ts-expect-error -- accessing inherited property
      this.session,
      this.schema,
      this.nestedIndex + 1,
    );
    // @ts-expect-error -- accessing inherited property
    await this.session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      // @ts-expect-error -- accessing inherited property
      await this.session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (error_) {
      // @ts-expect-error -- accessing inherited property
      await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`));
      throw error_;
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
  /** @internal assigned by drizzle's select builder after construction */
  declare joinsNotNullableMap: Record<string, boolean> | undefined;

  private fields: SelectedFieldsOrdered | undefined;
  private isResponseInArrayMode_: boolean;
  private mapper: RowMapper;

  constructor(
    private stmt: Statement,
    query: Query,
    private logger: Logger,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    /** @internal */ public customResultMapper?: (rows: unknown[][]) => unknown,
    casing?: CasingCache,
  ) {
    super("async", executeMethod, query);
    this.fields = fields;
    this.isResponseInArrayMode_ = isResponseInArrayMode;
    this.mapper = new RowMapper(fields, casing);
  }

  async run(
    placeholderValues?: Record<string, unknown>,
  ): Promise<{ success: boolean }> {
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {});
    this.logger.logQuery(this.query.sql, params);
    return this.stmt.run(...(params as any[]));
  }

  async all(placeholderValues?: Record<string, unknown>): Promise<T["all"]> {
    const placeholders = placeholderValues ?? {};
    const params: any[] = fillPlaceholders(this.query.params, placeholders);
    this.logger.logQuery(this.query.sql, params);

    if (!this.fields && !this.customResultMapper) {
      return this.stmt.all(...params) as T["all"];
    }

    const rows = (await this.stmt.all(...params)) as Record<string, unknown>[];

    return mapRows(
      rows,
      this.mapper,
      this.customResultMapper,
      this.joinsNotNullableMap,
    ) as T["all"];
  }

  async get(placeholderValues?: Record<string, unknown>): Promise<T["get"]> {
    const placeholders = placeholderValues ?? {};
    const params: any[] = fillPlaceholders(this.query.params, placeholders);
    this.logger.logQuery(this.query.sql, params);

    if (!this.fields && !this.customResultMapper) {
      return this.stmt.get(...params) as T["get"];
    }

    const row = (await this.stmt.get(...params)) as Record<string, unknown>;
    if (!row) return undefined as T["get"];

    if (this.customResultMapper) {
      return this.customResultMapper([this.mapper.toArray(row)]) as T["get"];
    }

    return this.mapper.toObject(row, this.joinsNotNullableMap) as T["get"];
  }

  async values<T extends any[] = unknown[]>(
    placeholderValues?: Record<string, unknown>,
  ): Promise<T[]> {
    const placeholders = placeholderValues ?? {};
    const params: any[] = fillPlaceholders(this.query.params, placeholders);
    this.logger.logQuery(this.query.sql, params);

    const rows = (await this.stmt.all(...params)) as Record<string, unknown>[];
    return rows.map((row) => this.mapper.toArray(row) as T);
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    return this.isResponseInArrayMode_;
  }
}
