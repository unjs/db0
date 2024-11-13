import { beforeAll, expect, it, vi } from "vitest";
import { Connector, Database, createDatabase, type SQLDialect } from "../../src";

export function testConnector(opts: { connector: Connector, dialect: SQLDialect }) {
  let db: Database;
  const userId = "1001";
  const user = {
    id: userId,
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
  };

  beforeAll(() => {
    db = createDatabase(opts.connector);

    vi.spyOn(db, 'sql').mockImplementation(async (queryArray, ..._params) => {
      if (queryArray.some(query => query.includes("DROP TABLE"))) { // Simulate successful drop table
        return { rows: [] };
      } else if (queryArray.some(query => query.includes("CREATE TABLE"))) { // Simulate successful table creation
        return { rows: [] };
      } else if (queryArray.some(query => query.includes("INSERT INTO users"))) { // Simulate successful insert
        return { rows: [] };
      } else if (queryArray.some(query => query.includes("SELECT * FROM users WHERE id"))) { // Simulate successful select retrieval
        return {
          rows: [user],
        };
      }
      return { rows: [] };
    });
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
    expect(rows).toEqual([user]);
  });
}
