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

/**
 * What db0's postgres connectors resolve `Statement.run()` with: `success`
 * plus every own field of the driver's own result object — `rowCount`,
 * `command` and `rows` (node-postgres, neon, hyperdrive), `affectedRows`
 * (pglite), `rowsAffected` (planetscale). Nothing beyond that is common to all
 * drivers, so every field is optional and the rest stays reachable.
 */
export type DB0PgRunResult = {
  success?: boolean;
  rowCount?: number | null;
  affectedRows?: number;
  rowsAffected?: number;
  command?: string;
  rows?: Record<string, unknown>[];
} & Record<string, unknown>;

/**
 * Drizzle instantiates this with the row type a statement returns, and with
 * `never` for the statements that return no rows at all — a non-returning
 * `insert`/`update`/`delete`. Those resolve to the connector's `run()` result
 * (see {@link DB0PgRunResult}), everything else to the rows themselves.
 */
export interface DB0PgQueryResultHKT extends PgQueryResultHKT {
  type: [this["row"]] extends [never]
    ? DB0PgRunResult
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

    // db0's postgres connectors keep nothing but the SQL string in a prepared
    // statement (the connection is resolved per execution), so it is prepared
    // once here instead of on every execution.
    const stmt = this.db.prepare(query.sql);

    const executor = returnsRows(mode, queryMetadata)
      ? async (params: unknown[] = []) => {
          const rows = await stmt.all(...(params as Primitive[]));
          return mode === "arrays"
            ? (rows as Record<string, unknown>[]).map((row) => toArray(row))
            : rows;
        }
      : // A statement without rows to return carries its result in the driver's
        // metadata (affected rows, command tag), which only `run()` surfaces —
        // `all()` would resolve it to an empty row array.
        (params: unknown[] = []) => stmt.run(...(params as Primitive[]));

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
      return rollbackAndRethrow(() => tx.execute(sql`rollback`), error);
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
 * statements that return nothing — `returning()` switches the mode to `arrays`
 * — while raw statements without metadata (`db.execute(sql`...`)`) may well
 * select rows.
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
