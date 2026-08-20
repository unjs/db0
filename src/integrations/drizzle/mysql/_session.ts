import { type Logger, type Query, NoopLogger, sql } from "drizzle-orm";

import { getRowConverter } from "../_utils.ts";

import {
  MySqlAsyncPreparedQuery,
  MySqlAsyncSession,
  MySqlAsyncTransaction,
} from "drizzle-orm/mysql-core";

import type {
  MySqlDialect,
  MySqlPreparedQueryConfig,
  MySqlQueryResultHKT,
  MySqlTransactionConfig,
} from "drizzle-orm/mysql-core";

import type { AnyRelations, Assume } from "drizzle-orm";

import type { Cache } from "drizzle-orm/cache/core";

import type { WithCacheConfig } from "drizzle-orm/cache/core/types";

import type { Database, Primitive } from "db0";

export interface DB0MySqlSessionOptions {
  logger?: Logger;
  cache?: Cache;
}

export interface DB0MySqlQueryResultHKT extends MySqlQueryResultHKT {
  type: Assume<
    this["row"],
    {
      [column: string]: any;
    }
  >[];
}

type QueryMetadata = {
  type: "select" | "update" | "delete" | "insert";
  tables: string[];
};

export class DB0MySqlSession<
  TRelations extends AnyRelations,
> extends MySqlAsyncSession<DB0MySqlQueryResultHKT, TRelations> {
  private logger: Logger;
  private cache: Cache | undefined;

  constructor(
    private db: Database,
    dialect: MySqlDialect,
    private relations: TRelations,
    options: DB0MySqlSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache;
  }

  prepareQuery<T extends MySqlPreparedQueryConfig>(
    query: Query,
    mode: "arrays" | "objects" | "raw",
    mapper?: (rows: any) => any,
    queryMetadata?: QueryMetadata,
    cacheConfig?: WithCacheConfig,
  ): MySqlAsyncPreparedQuery<T> {
    // db0 returns object rows; drizzle's mappers read them positionally.
    const toArray = getRowConverter(mapper);

    const executor = async (params: unknown[] = []) => {
      const rows = await this.db
        .prepare(query.sql)
        .all(...(params as Primitive[]));
      return mode === "arrays"
        ? (rows as Record<string, unknown>[]).map((row) => toArray(row))
        : rows;
    };

    return new MySqlAsyncPreparedQuery(
      executor,
      // db0 has no streaming API; drizzle then buffers the rows for `iterator()`.
      undefined,
      query,
      mapper,
      mode,
      this.logger,
      this.cache,
      queryMetadata,
      cacheConfig,
    );
  }

  // db0 exposes a single connection, so a transaction runs on this session and
  // nested ones become savepoints.
  override async transaction<T>(
    transaction: (tx: DB0MySqlTransaction<TRelations>) => Promise<T>,
    config?: MySqlTransactionConfig,
  ): Promise<T> {
    const tx = new DB0MySqlTransaction<TRelations>(
      this.dialect,
      this,
      this.relations,
      0,
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
  TRelations extends AnyRelations,
> extends MySqlAsyncTransaction<DB0MySqlQueryResultHKT, TRelations> {
  constructor(
    private db0Dialect: MySqlDialect,
    private db0Session: DB0MySqlSession<TRelations>,
    relations: TRelations,
    nestedIndex: number,
  ) {
    super(db0Dialect, db0Session, relations, nestedIndex);
  }

  override async transaction<T>(
    transaction: (tx: DB0MySqlTransaction<TRelations>) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new DB0MySqlTransaction<TRelations>(
      this.db0Dialect,
      this.db0Session,
      this._.relations,
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
