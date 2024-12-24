import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/database";
import sqlite from "../src/connectors/better-sqlite3";

const templates = {
  default: `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL
    )
  `,
  column: `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      "returning" INTEGER DEFAULT NULL
    )
  `,
  table: `
    CREATE TABLE "returning" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL
    )
  `,
};

const setup = async (template: string) => {
  const db = createDatabase(sqlite({ name: ":memory:" }));
  await db.sql`{${template}}`;
  return db;
};

describe("Database RETURNING clause", () => {
  it("Returns success when not using RETURNING", async () => {
    const db = await setup(templates.default);
    const creates =
      await db.sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${25})`;
    const updates = await db.sql`UPDATE users SET age = ${26} WHERE id = ${1}`;
    const deletes = await db.sql`DELETE FROM users WHERE id = ${1}`;

    expect(creates).toMatchObject({ success: true });
    expect(updates).toMatchObject({ success: true });
    expect(deletes).toMatchObject({ success: true });
  });

  it("Returns rows when using RETURNING", async () => {
    const db = await setup(templates.default);
    const creates =
      await db.sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${25}) RETURNING *`;
    const updates =
      await db.sql`UPDATE users SET age = ${26} WHERE id = ${1} RETURNING *`;
    const deletes = await db.sql`DELETE FROM users WHERE id = ${1} RETURNING *`;

    expect(creates).toMatchObject({ rows: [{ name: "Alice", age: 25 }] });
    expect(updates).toMatchObject({ rows: [{ name: "Alice", age: 26 }] });
    expect(deletes).toMatchObject({ rows: [{ name: "Alice", age: 26 }] });
  });

  describe("Ignores RETURNING used as non-keyword", () => {
    it('Ignores value "returning"', async () => {
      const db = await setup(templates.default);
      const value =
        await db.sql`INSERT INTO users (name, age) VALUES (${"RETURNING"}, ${25})`;

      expect(value).toMatchObject({ success: true });
    });

    it('Ignores column "returning"', async () => {
      const db = await setup(templates.column);
      const column =
        await db.sql`INSERT INTO users (name, age, "returning") VALUES (${"Alice"}, ${25}, ${50})`;

      expect(column).toMatchObject({ success: true });
    });

    it('Ignores table "returning"', async () => {
      const db = await setup(templates.table);
      const table =
        await db.sql`INSERT INTO "returning" (name, age) VALUES (${"Alice"}, ${25})`;

      expect(table).toMatchObject({ success: true });
    });
  });
});
