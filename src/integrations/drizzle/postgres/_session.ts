import { type Logger, type Query, NoopLogger, sql } from "drizzle-orm";

import { getRowConverter } from "../_utils.ts";

import {
  PgAsyncPreparedQuery,
  PgAsyncSession,
  PgAsyncTransaction,
} from "drizzle-orm/pg-core";

import type {
  PgDialect,
  PgQueryResultHKT,
  PgTransactionConfig,
  PreparedQueryConfig,
} from "drizzle-orm/pg-core";

import type { AnyRelations, Assume, SQL } from "drizzle-orm";

import type { Cache } from "drizzle-orm/cache/core";

import type { WithCacheConfig } from "drizzle-orm/cache/core/types";

import type { Database, Primitive } from "db0";

export interface DB0PgSessionOptions {
  logger?: Logger;
  cache?: Cache;
}

export interface DB0PgQueryResultHKT extends PgQueryResultHKT {
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

export class DB0PgSession<
  TRelations extends AnyRelations,
> extends PgAsyncSession<DB0PgQueryResultHKT, TRelations> {
  private logger: Logger;
  private cache: Cache | undefined;

  constructor(
    private db: Database,
    dialect: PgDialect,
    private relations: TRelations,
    options: DB0PgSessionOptions = {},
  ) {
    super(dialect);
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache;
  }

  prepareQuery<T extends PreparedQueryConfig = PreparedQueryConfig>(
    query: Query,
    mode: "arrays" | "objects" | "raw",
    _name: string | boolean,
    mapper?: (rows: any[]) => any,
    queryMetadata?: QueryMetadata,
    cacheConfig?: WithCacheConfig,
  ): PgAsyncPreparedQuery<T> {
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

    return new PgAsyncPreparedQuery(
      executor,
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
    transaction: (tx: DB0PgTransaction<TRelations>) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T> {
    const tx = new DB0PgTransaction<TRelations>(
      this.dialect,
      this,
      this.relations,
    );
    await tx.execute(
      sql`begin${config ? sql` ${transactionConfigSQL(config)}` : undefined}`,
    );
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

export class DB0PgTransaction<
  TRelations extends AnyRelations,
> extends PgAsyncTransaction<DB0PgQueryResultHKT, TRelations> {
  constructor(
    private db0Dialect: PgDialect,
    private db0Session: DB0PgSession<TRelations>,
    relations: TRelations,
    nestedIndex = 0,
  ) {
    super(db0Dialect, db0Session, relations, nestedIndex, false);
  }

  override async transaction<T>(
    transaction: (tx: DB0PgTransaction<TRelations>) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new DB0PgTransaction<TRelations>(
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

/** `BEGIN` modifiers, the same ones drizzle's own pg drivers emit. */
function transactionConfigSQL(config: PgTransactionConfig): SQL {
  const chunks: string[] = [];
  if (config.isolationLevel) {
    chunks.push(`isolation level ${config.isolationLevel}`);
  }
  if (config.accessMode) {
    chunks.push(config.accessMode);
  }
  if (typeof config.deferrable === "boolean") {
    chunks.push(config.deferrable ? "deferrable" : "not deferrable");
  }
  return sql.raw(chunks.join(" "));
}
