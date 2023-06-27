import type { Query, TablesRelationalConfig } from "drizzle-orm";

import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
  PreparedQuery,
  SQLiteSession,
} from "drizzle-orm/sqlite-core";

import type {
  PreparedQueryConfig,
  SelectedFieldsOrdered,
} from "drizzle-orm/sqlite-core";

import type { Database } from "../../../src";

export type DrizzleDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>
> = BaseSQLiteDatabase<"async", any, TSchema>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>
>(db: Database): DrizzleDatabase<TSchema> {
  const dialect = new SQLiteAsyncDialect();

  // TODO: Support schema
  const schema = undefined;

  const session = new SQLiteDB0Session(db, dialect, undefined);

  return new BaseSQLiteDatabase(
    "async",
    dialect,
    session,
    schema
  ) as DrizzleDatabase<TSchema>;
}

export class SQLiteDB0Session<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig
> extends SQLiteSession<"async", unknown, TFullSchema, TSchema> {
  db: Database;
  schema: any;
  dialect: SQLiteAsyncDialect;

  constructor(db: any, dialect: SQLiteAsyncDialect, schema: any) {
    super(dialect);
    this.db = db;
    this.dialect = dialect;
    this.schema = schema;
  }

  prepareQuery(
    query: Query,
    fields?: SelectedFieldsOrdered,
    customResultMapper?: (rows: unknown[][]) => unknown
  ): PreparedQuery<any> {
    const stmt = this.db.prepare(query.sql);
    return new DB0PreparedQuery({
      stmt,
      query,
      fields,
      customResultMapper,
    });
  }

  transaction<T>(): Promise<T> {
    throw new Error("transaction is not implemented!");
  }
}

export class DB0PreparedQuery<
  T extends PreparedQueryConfig
> extends PreparedQuery<T> {
  ctx: {
    stmt: any;
    query: Query;
    fields?: SelectedFieldsOrdered;
    customResultMapper?: (rows: unknown[][]) => unknown;
  };

  constructor(ctx: DB0PreparedQuery<any>["ctx"]) {
    super();
    this.ctx = ctx;
  }

  run() {
    return this.ctx.stmt.run(...this.ctx.query.params);
  }

  all() {
    return this.ctx.stmt.all(...this.ctx.query.params);
  }

  get() {
    return this.ctx.stmt.get(...this.ctx.query.params);
  }

  values() {
    throw new Error("values is not implemented!");
  }
}
