import { expect, it, mock } from "bun:test";

import connector from "../../src/connectors/bun-sqlite";
import { getCreateDatabaseMock, userId } from "./mocks";

it("connectors: bun", async () => {
  // Mock the module before importing
  mock(() => getCreateDatabaseMock());

  // Lazily import the module after mocking (this is necessary to avoid errors)
  const { createDatabase } = await import('../../src');

  // Initialize the database after the module has been imported and mock is applied
  const db = createDatabase(connector({ name: ":memory:" }));

  await db.sql`DROP TABLE IF EXISTS users`;
  await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
  expect(rows).toMatchObject([{ id: userId, firstName: "John", lastName: "Doe", email: "" }]);
})
