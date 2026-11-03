import { describe, expect, it } from "vitest";
import connector from "../src/connectors/better-sqlite3";
import { createDatabase } from "../src";

// `db.sql` picks `all()` or `run()` from a keyword test over the statement
// text. On better-sqlite3 `all()` throws for a statement that returns no rows,
// so a keyword the router mistakes for SQL syntax inside a literal decides
// whether the write happens at all.
describe("database: sql template routing", () => {
  const open = () => createDatabase(connector({ name: ":memory:" }));

  it("executes a write whose string literal contains 'returning'", async () => {
    const db = open();
    await db.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT)");

    await db.sql`INSERT INTO notes (title) VALUES ('parcel returning to sender')`;

    const { rows } = await db.sql`SELECT title FROM notes`;
    expect(rows).toEqual([{ title: "parcel returning to sender" }]);
    await db.dispose?.();
  });

  it("executes a write whose comment contains 'returning'", async () => {
    const db = open();
    await db.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT)");

    await db.sql`INSERT INTO notes (title) VALUES ('first') -- returning to sender`;

    const { rows } = await db.sql`SELECT title FROM notes`;
    expect(rows).toEqual([{ title: "first" }]);
    await db.dispose?.();
  });

  it("still routes a real RETURNING clause to all()", async () => {
    const db = open();
    await db.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT)");

    const returning =
      await db.sql`INSERT INTO notes (title) VALUES ('x') RETURNING id`;
    expect(returning.rows).toEqual([{ id: 1 }]);

    const noSpace =
      await db.sql`INSERT INTO notes (title) VALUES ('y') RETURNING(id)`;
    expect(noSpace.rows).toEqual([{ id: 2 }]);
    await db.dispose?.();
  });

  it("keeps a quoted identifier from being read as a keyword", async () => {
    const db = open();
    await db.exec('CREATE TABLE "returning" ("id" INTEGER)');

    await db.sql`INSERT INTO "returning" ("id") VALUES (1)`;

    const { rows } = await db.sql`SELECT "id" FROM "returning"`;
    expect(rows).toEqual([{ id: 1 }]);
    await db.dispose?.();
  });
});
