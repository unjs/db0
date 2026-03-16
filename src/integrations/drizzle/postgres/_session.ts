import {
  type Logger,
  type RelationalSchemaConfig,
  type TablesRelationalConfig,
  NoopLogger,
  fillPlaceholders,
  sql,
} from "drizzle-orm";

import {
  PgDialect,
  PgPreparedQuery,
  PgSession,
  PgTransaction,
} from "drizzle-orm/pg-core";

import type {
  PreparedQueryConfig,
  PgTransactionConfig,
  PgQueryResultHKT,
  SelectedFieldsOrdered,
} from "drizzle-orm/pg-core";

import type { Query } from "drizzle-orm";

import type { Database } from "db0";

export interface DB0PgSessionOptions {
  logger?: Logger;
}

type Assume<T, U> = T extends U ? T : U;

export interface DB0PgQueryResultHKT extends PgQueryResultHKT {
  type: Assume<
    this["row"],
    {
      [column: string]: any;
    }
  >[];
}

export class DB0PgSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends PgSession<DB0PgQueryResultHKT, TFullSchema, TSchema> {
  private logger: Logger;

  constructor(
    private db: Database,
    dialect: PgDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    options: DB0PgSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
  }

  prepareQuery<T extends PreparedQueryConfig = PreparedQueryConfig>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    _name: string | undefined,
    _isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => T["execute"],
  ): DB0PgPreparedQuery<T> {
    return new DB0PgPreparedQuery(
      this.db,
      query.sql,
      query.params,
      this.logger,
      fields,
      customResultMapper,
    );
  }

  override async transaction<T>(
    transaction: (tx: DB0PgTransaction<TFullSchema, TSchema>) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T> {
    const tx = new DB0PgTransaction<TFullSchema, TSchema>(
      this.dialect,
      this,
      this.schema,
    );
    const configSql =
      // @ts-expect-error -- accessing @internal method
      config ? sql` ${tx.getTransactionConfigSQL(config)}` : undefined;
    await tx.execute(sql`begin${configSql}`);
    try {
      const result = await transaction(tx);
      await tx.execute(sql`commit`);
      return result;
    } catch (error) {
      await tx.execute(sql`rollback`);
      throw error;
    }
  }

  override async count(query: import("drizzle-orm").SQL): Promise<number> {
    const res = await this.execute<{ count: string }[]>(query);
    return Number(res[0]["count"]);
  }
}

export class DB0PgTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends PgTransaction<DB0PgQueryResultHKT, TFullSchema, TSchema> {
  override async transaction<T>(
    transaction: (tx: DB0PgTransaction<TFullSchema, TSchema>) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new DB0PgTransaction<TFullSchema, TSchema>(
      // @ts-expect-error -- accessing inherited property
      this.dialect,
      // @ts-expect-error -- accessing inherited property
      this.session,
      this.schema,
      this.nestedIndex + 1,
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

export class DB0PgPreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig,
> extends PgPreparedQuery<T> {
  constructor(
    private db: Database,
    private queryString: string,
    private params: unknown[],
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    private customResultMapper?: (rows: unknown[][]) => T["execute"],
  ) {
    super({ sql: queryString, params }, undefined, undefined);
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

  async all(): Promise<T["all"]> {
    const stmt = this.db.prepare(this.queryString);
    this.logger.logQuery(this.queryString, this.params);
    return stmt.all(...(this.params as any[])) as Promise<T["all"]>;
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    // db0 always returns object rows, never array rows
    return false;
  }
}
