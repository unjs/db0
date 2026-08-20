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

/**
 * What db0's mysql connectors resolve `Statement.run()` with: `success` plus
 * every own field of the driver's own result — mysql2's `ResultSetHeader`
 * (`affectedRows`, `insertId`, `changedRows`, `warningStatus`) or
 * planetscale's `{ rowsAffected, insertId }`. Nothing beyond that is common to
 * all drivers, so every field is optional and the rest stays reachable.
 */
export type DB0MySqlRunResult = {
  success?: boolean;
  affectedRows?: number;
  rowsAffected?: number;
  changedRows?: number;
  insertId?: number | string;
} & Record<string, unknown>;

/**
 * Drizzle instantiates this with the row type a statement returns, and with
 * `never` for the statements that return no rows at all — an
 * `insert`/`update`/`delete` without `$returningId()`. Those resolve to the
 * connector's `run()` result (see {@link DB0MySqlRunResult}), everything else
 * to the rows themselves.
 */
export interface DB0MySqlQueryResultHKT extends MySqlQueryResultHKT {
  type: [this["row"]] extends [never]
    ? DB0MySqlRunResult
    : Assume<
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

    // db0's mysql connectors keep nothing but the SQL string in a prepared
    // statement (the connection is resolved per execution), so it is prepared
    // once here instead of on every execution.
    const stmt = this.db.prepare(query.sql);

    const rowsExpected = returnsRows(mode, queryMetadata);

    const executor = rowsExpected
      ? async (params: unknown[] = []) => {
          const rows = await stmt.all(...(params as Primitive[]));
          return mode === "arrays"
            ? (rows as Record<string, unknown>[]).map((row) => toArray(row))
            : rows;
        }
      : // A statement without rows to return carries its result in the driver's
        // metadata (affected rows, insert id), which `run()` surfaces. `all()`
        // hands back the raw `ResultSetHeader` under an `unknown[]` type,
        // which is not even an array.
        (params: unknown[] = []) => stmt.run(...(params as Primitive[]));

    return new MySqlAsyncPreparedQuery(
      executor,
      // db0 has no streaming API, so `iterator()` cannot stream: the query runs
      // to completion and the whole result set is held in memory before the
      // first row is yielded. Without an explicit iterator drizzle falls back to
      // iterating the executor result, which throws `rows is not iterable` for
      // the statements that resolve to driver metadata instead of rows.
      rowsExpected
        ? async function* (params) {
            yield* (await executor(params)) as any[][];
          }
        : // eslint-disable-next-line require-yield
          async function* () {
            throw new Error(
              `[db0] [drizzle] \`iterator()\` is not supported for \`${queryMetadata?.type ?? "raw"}\` statements: ` +
                `they resolve to the driver's result metadata (affected rows, insert id), not to rows. ` +
                `Await the query (or call \`.execute()\`) instead.`,
            );
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
      return rollbackAndRethrow(() => tx.execute(sql`rollback`), error);
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
      return rollbackAndRethrow(
        () => tx.execute(sql.raw(`rollback to savepoint ${savepointName}`)),
        error_,
      );
    }
  }
}

/**
 * Whether the statement drizzle prepared returns rows.
 *
 * Drizzle only uses `raw` mode with `insert`/`update`/`delete` metadata for
 * statements that return nothing (`$returningId()` derives its ids from the
 * insert metadata), while raw statements without metadata
 * (`db.execute(sql`...`)`) may well select rows.
 */
function returnsRows(
  mode: "arrays" | "objects" | "raw",
  queryMetadata: QueryMetadata | undefined,
): boolean {
  return (
    mode !== "raw" ||
    queryMetadata === undefined ||
    queryMetadata.type === "select"
  );
}

/**
 * Rolls back and rethrows the error the transaction body failed with.
 *
 * Awaiting the rollback directly in a `catch` block replaces the caller's error
 * with the rollback's own one whenever the rollback fails too (a dropped
 * connection, a server-aborted transaction) — exactly when the original error
 * matters most. The rollback failure is attached as `cause` so it is still
 * reported, never as a replacement.
 */
async function rollbackAndRethrow(
  rollback: () => PromiseLike<unknown>,
  error: unknown,
): Promise<never> {
  try {
    await rollback();
  } catch (rollbackError) {
    if (error instanceof Error && error.cause === undefined) {
      try {
        error.cause = rollbackError;
      } catch {
        // A frozen error cannot carry the rollback failure.
      }
    }
  }
  throw error;
}
