import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineRelations, eq, sql } from "drizzle-orm";

import * as dSqlite from "drizzle-orm/sqlite-core";
import { PgDialect, pgSchema, text as pgText } from "drizzle-orm/pg-core";

import { type Database, createDatabase } from "../../../src";
import { drizzle } from "../../../src/integrations/drizzle";
import {
  getRowConverter,
  trackSelectedFields,
} from "../../../src/integrations/drizzle/_utils";

import betterSqlite3 from "../../../src/connectors/better-sqlite3";

// db0 rejects a query whose fields it cannot tell apart in an object row. The
// rejection happens while a session converts rows, so drizzle wraps it in a
// `DrizzleQueryError`; the checks that do not need a row run from the mapper
// drizzle applies to the (possibly empty) result, where they are not wrapped.
async function mappingError(query: PromiseLike<unknown>): Promise<string> {
  const error = await Promise.resolve(query).then(
    () => undefined,
    (error_: Error) => error_,
  );
  expect(error, "expected the query to be rejected").toBeInstanceOf(Error);
  return (error!.cause as Error | undefined)?.message ?? error!.message;
}

describe("integrations: drizzle: row mapping (better-sqlite3)", () => {
  const numbers = dSqlite.sqliteTable("rm_numbers", {
    id: dSqlite.integer("id").primaryKey(),
    amount: dSqlite.numeric("amount"),
    big: dSqlite.numeric("big", { mode: "bigint" }),
  });
  const items = dSqlite.sqliteTable("rm_items", {
    id: dSqlite.integer("id").primaryKey(),
    name: dSqlite.text("name"),
  });
  const values = dSqlite.sqliteTable("rm_values", {
    id: dSqlite.integer("id").primaryKey(),
    value: dSqlite.integer("value"),
  });

  let drizzleDb: ReturnType<typeof drizzle>;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(betterSqlite3({ name: ":memory:" }));
    drizzleDb = drizzle(db);
    await db.sql`CREATE TABLE rm_numbers (id INTEGER PRIMARY KEY, amount NUMERIC, big NUMERIC)`;
    await db.sql`CREATE TABLE rm_items (id INTEGER PRIMARY KEY, name TEXT)`;
    await db.sql`CREATE TABLE rm_values (id INTEGER PRIMARY KEY, value INTEGER)`;
    await db.sql`INSERT INTO rm_numbers VALUES (1, '12.5', '9007199254740993')`;
    await db.sql`INSERT INTO rm_items VALUES (1, 'Ada')`;
    await db.sql`INSERT INTO rm_values VALUES (1, 99)`;
  });

  afterAll(async () => {
    await db.dispose();
  });

  // The dialect emits `numeric()` as an unaliased `cast("amount" as text)`, so
  // the driver keys the row after the cast, not after the column.
  it("maps columns the dialect renamed by casting them", async () => {
    const rows = await drizzleDb.select().from(numbers).all();

    expect(rows).toEqual([
      { id: 1, amount: "12.5", big: 9_007_199_254_740_993n },
    ]);
  });

  it("maps a cast column selected next to a bare expression", async () => {
    const rows = await drizzleDb
      .select({ amount: numbers.amount, twice: sql<number>`1 + 1` })
      .from(numbers)
      .all();

    expect(rows).toEqual([{ amount: "12.5", twice: 2 }]);
  });

  it("rejects two bare expressions that come back under one key", async () => {
    const message = await mappingError(
      drizzleDb
        .select({ a: sql<number>`1 + 1`, b: sql<number>`1 + 1` })
        .from(items)
        .all(),
    );

    expect(message).toMatch(/^\[db0] \[drizzle] cannot map query result: /);
    expect(message).toMatch(/`a`, `b`/);
  });

  it("rejects a bare expression that collides with a selected column", async () => {
    const message = await mappingError(
      drizzleDb
        .select({ n: items.name, m: sql<string>`name` })
        .from(items)
        .all(),
    );

    expect(message).toMatch(/^\[db0] \[drizzle] cannot map query result: /);
    expect(message).toMatch(/`m`/);
  });

  it("rejects a column selected twice under two names", async () => {
    const message = await mappingError(
      drizzleDb
        .select({ a: items.id, b: sql<number>`${items.id}` })
        .from(items)
        .all(),
    );

    expect(message).toMatch(/^\[db0] \[drizzle] cannot map query result: /);
    expect(message).toMatch(/`b`/);
  });

  it("rejects two different expressions sharing one alias", async () => {
    const message = await mappingError(
      drizzleDb
        .select({ a: sql<number>`1`.as("x"), b: sql<number>`2`.as("x") })
        .from(items)
        .all(),
    );

    expect(message).toMatch(
      /cannot map query result: `a \(aliased as "x"\)` and `b \(aliased as "x"\)` both come back as `x`/,
    );
  });

  // The check runs from the mapper drizzle applies to every result, so an empty
  // one is rejected too, instead of passing until the first row shows up.
  it("rejects two expressions sharing one alias on an empty result", async () => {
    const message = await mappingError(
      drizzleDb
        .select({ a: sql<number>`1`.as("x"), b: sql<number>`2`.as("x") })
        .from(items)
        .where(sql`1 = 0`)
        .all(),
    );

    expect(message).toMatch(/both come back as `x`/);
  });

  it("keeps one aliased expression selected twice", async () => {
    const total = sql<number>`count(*)`.mapWith(Number).as("total");
    const rows = await drizzleDb
      .select({ a: total, b: total })
      .from(items)
      .all();

    expect(rows).toEqual([{ a: 1, b: 1 }]);
  });

  it("maps a scalar subquery by its alias", async () => {
    const value = drizzleDb
      .select({ value: values.value })
      .from(values)
      .where(eq(values.id, items.id))
      .as("item_value");
    const rows = await drizzleDb
      .select({ value, id: items.id })
      .from(items)
      .all();

    expect(rows).toEqual([{ value: 99, id: 1 }]);
  });

  it("rejects a scalar subquery whose alias collides with a column", async () => {
    const value = drizzleDb
      .select({ value: values.value })
      .from(values)
      .where(eq(values.id, items.id))
      .as("id");
    const message = await mappingError(
      drizzleDb.select({ value, id: items.id }).from(items).all(),
    );

    expect(message).toMatch(
      /`value \(subquery "id"\)` and `rm_items.id` both come back as `id`/,
    );
  });

  it("keeps a scalar subquery selected next to a bare expression", async () => {
    const value = drizzleDb
      .select({ value: values.value })
      .from(values)
      .where(eq(values.id, items.id))
      .as("item_value");
    const rows = await drizzleDb
      .select({ value, answer: sql<number>`42` })
      .from(items)
      .all();

    expect(rows).toEqual([{ value: 99, answer: 42 }]);
  });

  it("rejects a field the driver could not key at all", async () => {
    // better-sqlite3 builds rows by assignment, so a column named `__proto__`
    // never becomes an own key — reading it would hand back a prototype.
    const message = await mappingError(
      drizzleDb
        .select({ p: sql<number>`1`.as("__proto__") })
        .from(items)
        .all(),
    );

    expect(message).toMatch(/^\[db0] \[drizzle] cannot map query result: /);
    expect(message).toMatch(/`p`/);
  });

  it("keeps expression keys too large to be array indices", async () => {
    const rows = await drizzleDb
      .select({
        big: sql<number>`4294967295`,
        length: sql<number>`length(name)`,
      })
      .from(items)
      .all();

    expect(rows).toEqual([{ big: 4_294_967_295, length: 3 }]);
  });
});

describe("integrations: drizzle: row mapping without a field list", () => {
  const notes = dSqlite.sqliteTable("rm_notes", {
    id: dSqlite.integer("id").primaryKey(),
    a: dSqlite.integer("a"),
    b: dSqlite.integer("b"),
  });
  const relations = defineRelations({ notes });

  let drizzleDb: ReturnType<typeof drizzle<typeof relations>>;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(betterSqlite3({ name: ":memory:" }));
    drizzleDb = drizzle(db, { relations });
    await db.sql`CREATE TABLE rm_notes (id INTEGER PRIMARY KEY, a INTEGER, b INTEGER)`;
    await db.sql`INSERT INTO rm_notes VALUES (1, 10, 20)`;
  });

  afterAll(async () => {
    await db.dispose();
  });

  // The relational query builder appends its extras after the columns, but JS
  // enumerates an index-like key first, so the values no longer line up.
  it("rejects relational extras the driver names like an array index", async () => {
    const message = await mappingError(
      drizzleDb.query.notes.findMany({
        columns: { a: true, b: true },
        extras: { 7: sql<number>`999`.as("7") },
      }),
    );

    expect(message).toMatch(
      /cannot map query result: the driver named a selected expression `7`/,
    );
  });

  it("keeps relational extras named like a column", async () => {
    const rows = await drizzleDb.query.notes.findMany({
      columns: { a: true, b: true },
      extras: { seven: sql<number>`999`.as("seven") },
    });

    expect(rows).toEqual([{ a: 10, b: 20, seven: 999 }]);
  });
});

describe("integrations: drizzle: row mapping of same-named tables", () => {
  // Postgres refuses the join this describes and MySQL needs a server, so the
  // field list is handed to the tracked mapper generator directly.
  const convert = (fields: { path: string[]; field: any }[]) => {
    const dialect = trackSelectedFields(new PgDialect());
    const mapper = dialect.mapperGenerators.rows(fields as any, undefined);
    return getRowConverter(mapper);
  };

  it("tells same-named columns of two schemas apart", () => {
    const app = pgSchema("app").table("entries", { name: pgText("name") });
    const audit = pgSchema("audit").table("entries", { name: pgText("name") });

    expect(() =>
      convert([
        { path: ["a"], field: app.name },
        { path: ["b"], field: audit.name },
      ])({ name: "audited" }),
    ).toThrow(
      /`app.entries.name` and `audit.entries.name` both come back as `name`/,
    );
  });

  it("keeps the same column selected twice", () => {
    const app = pgSchema("app").table("entries", { name: pgText("name") });

    expect(
      convert([
        { path: ["a"], field: app.name },
        { path: ["b"], field: app.name },
      ])({ name: "kept" }),
    ).toEqual(["kept", "kept"]);
  });
});
