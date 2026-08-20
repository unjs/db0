import { type Logger, type Query, NoopLogger, sql } from "drizzle-orm";

import { getRowConverter } from "../_utils.ts";

import {
  SQLiteAsyncPreparedQuery,
  SQLiteAsyncSession,
  SQLiteAsyncTransaction,
} from "drizzle-orm/sqlite-core";

import type {
  SQLiteDialect,
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from "drizzle-orm/sqlite-core";

import type { AnyRelations } from "drizzle-orm";

import type { Cache } from "drizzle-orm/cache/core";

import type { WithCacheConfig } from "drizzle-orm/cache/core/types";

import type { Database, Primitive, Statement } from "db0";

export type DB0SQLiteRunResult = Awaited<ReturnType<Statement["run"]>>;

export interface DB0SQLiteSessionOptions {
  logger?: Logger;
  cache?: Cache;
}

type QueryMetadata = {
  type: "select" | "update" | "delete" | "insert";
  tables: string[];
};

export class DB0SQLiteSession<
  TRelations extends AnyRelations,
> extends SQLiteAsyncSession<"async", DB0SQLiteRunResult, TRelations> {
  private logger: Logger;
  private cache: Cache | undefined;

  constructor(
    private db: Database,
    dialect: SQLiteDialect,
    private relations: TRelations,
    options: DB0SQLiteSessionOptions = {},
  ) {
    super(dialect, "async");
    this.logger = options.logger ?? new NoopLogger();
    this.cache = options.cache;
  }

  prepareQuery(
    query: Query,
    mode: "arrays" | "objects" | "raw",
    _prepare: boolean,
    executeMethod?: SQLiteExecuteMethod,
    mapper?: (rows: any[]) => any,
    queryMetadata?: QueryMetadata,
    cacheConfig?: WithCacheConfig,
  ): SQLiteAsyncPreparedQuery<any> {
    const stmt = this.db.prepare(query.sql);
    // db0 returns object rows; drizzle's mappers read them positionally.
    const toArray = getRowConverter(mapper);
    const asRows = (rows: unknown[]) =>
      mode === "arrays"
        ? (rows as Record<string, unknown>[]).map((row) => toArray(row))
        : rows;

    return new SQLiteAsyncPreparedQuery(
      "async",
      executeMethod,
      {
        all: (params) => stmt.all(...(params as Primitive[])).then(asRows),
        get: (params) =>
          stmt
            .get(...(params as Primitive[]))
            .then((row) =>
              row
                ? mode === "arrays"
                  ? toArray(row as Record<string, unknown>)
                  : row
                : undefined,
            ),
        run: (params) => stmt.run(...(params as Primitive[])),
        values: (params) =>
          stmt
            .all(...(params as Primitive[]))
            .then((rows) =>
              (rows as Record<string, unknown>[]).map((row) => toArray(row)),
            ),
      },
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
    transaction: (tx: DB0SQLiteTransaction<TRelations>) => Promise<T>,
    config?: SQLiteTransactionConfig,
  ): Promise<T> {
    const tx = new DB0SQLiteTransaction<TRelations>(
      "async",
      this.dialect,
      this,
      this.relations,
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
  TRelations extends AnyRelations,
> extends SQLiteAsyncTransaction<"async", DB0SQLiteRunResult, TRelations> {
  constructor(
    resultKind: "async",
    private db0Dialect: SQLiteDialect,
    private db0Session: DB0SQLiteSession<TRelations>,
    relations: TRelations,
    nestedIndex = 0,
  ) {
    super(resultKind, db0Dialect, db0Session, relations, nestedIndex);
  }

  override async transaction<T>(
    transaction: (tx: DB0SQLiteTransaction<TRelations>) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex + 1}`;
    const tx = new DB0SQLiteTransaction<TRelations>(
      "async",
      this.db0Dialect,
      this.db0Session,
      this._.relations,
      this.nestedIndex + 1,
    );
    await this.db0Session.run(sql.raw(`savepoint ${savepointName}`));
    try {
      const result = await transaction(tx);
      await this.db0Session.run(sql.raw(`release savepoint ${savepointName}`));
      return result;
    } catch (error_) {
      await this.db0Session.run(
        sql.raw(`rollback to savepoint ${savepointName}`),
      );
      throw error_;
    }
  }
}
