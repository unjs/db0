import { beforeAll, expect, it } from "vitest";
import { Connector, Database, createDatabase, type SQLDialect } from "../../src";

export function testConnector(opts: { connector: Connector, dialect: SQLDialect }) {
  let db: Database;
  beforeAll(() => {
    db = createDatabase(opts.connector);
  });

  const userId = "1001";

  it("dialect matches", () => {
    expect(db.dialect).toBe(opts.dialect);
  })

  it("drop and create table", async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
    switch (opts.dialect) {
      case "mysql": {
        await db.sql`CREATE TABLE users (\`id\` VARCHAR(4) PRIMARY KEY, \`firstName\` TEXT, \`lastName\` TEXT, \`email\` TEXT)`;
        break;
      }
      default: {
        await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;
        break;
      }
    }
  });

  it("insert", async () => {
    await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;
  });

  it("select", async () => {
    const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
    expect(rows).toMatchInlineSnapshot(`
      [
        {
          "email": "",
          "firstName": "John",
          "id": "1001",
          "lastName": "Doe",
        },
      ]
    `);
  });
}
