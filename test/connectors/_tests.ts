import { beforeAll, expect, it } from "vitest";
import {
  Connector,
  Database,
  createDatabase,
  type SQLDialect,
} from "../../src";

export function testConnector<TConnector extends Connector = Connector>(opts: {
  connector: TConnector;
  dialect: SQLDialect;
}) {
  let db: Database<TConnector>;
  beforeAll(() => {
    db = createDatabase(opts.connector);
  });

  const userId = "1001";
  const userSnapshot = `
    [
      {
        "email": "",
        "firstName": "John",
        "id": "1001",
        "lastName": "Doe",
      },
    ]
  `;

  it("instance matches", async () => {
    const instance = await db.getInstance();
    expect(instance).toBeDefined();
    expect(instance).toBe(await opts.connector.getInstance());
  });

  it("dialect matches", () => {
    expect(db.dialect).toBe(opts.dialect);
  });

  it("drop and create table", async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
    switch (opts.dialect) {
      case "mysql": {
        await db.sql`CREATE TABLE users (\`id\` VARCHAR(4) PRIMARY KEY, \`firstName\` TEXT, \`lastName\` TEXT, \`email\` TEXT)`;
        break;
      }
      case "mssql": {
        await db.sql`CREATE TABLE users (
            [id] NVARCHAR(4) PRIMARY KEY,
            [firstName] NVARCHAR(255),
            [lastName] NVARCHAR(255),
            [email] NVARCHAR(255)
        )`;
        break;
      }
      default: {
        await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;
        break;
      }
    }
  });

  it("insert", async () => {
    switch (opts.dialect) {
      case "mysql": {
        await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;
        break;
      }
      case "mssql": {
        await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;
        break;
      }
      default: {
        const { rows } =
          await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '') RETURNING *`;
        expect(rows).toMatchInlineSnapshot(userSnapshot);
        break;
      }
    }
  });

  it("select", async () => {
    const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
    expect(rows).toMatchInlineSnapshot(userSnapshot);
  });

  it("deferred prepare errors", async () => {
    await expect(
      db.prepare("SELECT * FROM non_existing_table").all(),
    ).rejects.toThrowError("non_existing_table");
  });

  it("dispose", async () => {
    await db.dispose();
    expect(db.disposed).toBe(true);

    let err;
    try {
      await db.getInstance();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe(
      "This database instance has been disposed and cannot be used.",
    );
  });
}
