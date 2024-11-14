import { beforeAll, expect, it, vi } from "vitest";
import { Connector, Database, type SQLDialect } from "../../src";
import { getCreateDatabaseMock, userId } from "./mocks";

export function testConnector(opts: { connector: Connector, dialect: SQLDialect }) {
  let db: Database;

  beforeAll(async () => {
    // Mock the module before importing
    vi.mock('../../src', () => getCreateDatabaseMock());

    // Lazily import the module after mocking (this is necessary to avoid errors)
    const { createDatabase } = await import('../../src');

    // Initialize the database after the module has been imported and mock is applied
    db = createDatabase(opts.connector);
  });

  it("dialect matches", () => {
    expect(db.dialect).toBe(opts.dialect);
  })

  it("drop and create table", async () => {
    const { rows: dropRows } = await db.sql`DROP TABLE IF EXISTS users`;
    expect(dropRows).toEqual([]);
    switch (opts.dialect) {
      case "mysql": {
        const { rows } = await db.sql`CREATE TABLE users (\`id\` VARCHAR(4) PRIMARY KEY, \`firstName\` TEXT, \`lastName\` TEXT, \`email\` TEXT)`;
        expect(rows).toEqual([]);
        break;
      }
      default: {
        const { rows } = await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;
        expect(rows).toEqual([]);
        break;
      }
    }
  });

  it("insert", async () => {
    const { rows } = await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;
    expect(rows).toEqual([]);
  });

  it("select", async () => {
    const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
    expect(rows).toEqual([{
      id: userId,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
    }]);
  });
}
