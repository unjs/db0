import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/database";
import sqlite from "../src/connectors/better-sqlite3";

const setup = async () => {
  const db = createDatabase(sqlite({ name: ":memory:" }));
  await db.sql`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL
    )
  `;
  return db;
};

describe("Database RETURNING clause", () => {
  it("Returns success when not using RETURNING", async () => {
    const db = await setup();
    const creates =
      await db.sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${25})`;
    const updates = await db.sql`UPDATE users SET age = ${26} WHERE id = ${1}`;
    const deletes = await db.sql`DELETE FROM users WHERE id = ${1}`;

    expect(creates).toMatchObject({ success: true });
    expect(updates).toMatchObject({ success: true });
    expect(deletes).toMatchObject({ success: true });
  });

  it("Returns rows when using RETURNING", async () => {
    const db = await setup();
    const creates =
      await db.sql`INSERT INTO users (name, age) VALUES (${"Alice"}, ${25}) RETURNING *`;
    const updates =
      await db.sql`UPDATE users SET age = ${26} WHERE id = ${1} RETURNING *`;
    const deletes = await db.sql`DELETE FROM users WHERE id = ${1} RETURNING *`;

    expect(creates).toMatchObject({ rows: [{ name: "Alice", age: 25 }] });
    expect(updates).toMatchObject({ rows: [{ name: "Alice", age: 26 }] });
    expect(deletes).toMatchObject({ rows: [{ name: "Alice", age: 26 }] });
  });
});
