import {
  BaseSQLiteDatabase,
  SQLiteAsyncDialect,
} from "drizzle-orm/sqlite-core";
import type { Database } from "db0";
import { DB0Session } from "./_session";

export type DrizzleDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> = BaseSQLiteDatabase<"async", any, TSchema>;

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(db: Database): DrizzleDatabase<TSchema> {
  // TODO: Support schema
  const schema = undefined;

  const dialect = new SQLiteAsyncDialect();

  const session = new DB0Session(db, dialect, schema);

  return new BaseSQLiteDatabase(
    "async",
    dialect,
    session,
    schema,
  ) as DrizzleDatabase<TSchema>;
}
