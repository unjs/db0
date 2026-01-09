import { beforeAll, expect, describe, it } from "vitest";
import {
  type Connector,
  type Database,
  createDatabase,
  type SQLDialect,
} from "../../src/index.ts";

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

  describe("acquireConnection", () => {
    it("should return a connection that can execute queries", async () => {
      await db.acquireConnection(async (connection) => {
        const { rows } = await connection.sql`SELECT * FROM users`;
        expect(rows).toMatchInlineSnapshot(userSnapshot);
      });
    });

    it.runIf(opts.connector.supportsPooling)(
      "should not block other queries",
      async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        void db.acquireConnection(async () => {
          await promise;
        });

        await expect(db.sql`SELECT * FROM users`).resolves.not.toThrow();
        resolve();
      },
    );

    it.runIf(!opts.connector.supportsPooling)(
      "should block other queries until the connection is released",
      async () => {
        const { promise, resolve } = Promise.withResolvers<void>();
        void db.acquireConnection(async () => {
          await promise;
        });

        let secondPromiseResolved = false;
        const secondQueryPromise = db.sql`SELECT * FROM users`.then(() => {
          secondPromiseResolved = true;
        });
        expect(secondPromiseResolved).toBe(false);
        resolve();
        await secondQueryPromise;
        expect(secondPromiseResolved).toBe(true);
      },
    );
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
