import { describe, expect, test } from "bun:test";

import connector from "../../src/connectors/bun-sqlite";
import { createDatabase } from "../../src";

test("connectors: bun", async () => {
  const db = createDatabase(connector({ name: ":memory:" }));

  const userId = "1001";

  await db.sql`DROP TABLE IF EXISTS users`;
  await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
  expect(rows).toMatchObject([
    { id: userId, firstName: "John", lastName: "Doe", email: "" },
  ]);
});
