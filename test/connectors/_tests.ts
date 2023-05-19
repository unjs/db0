import { beforeAll, expect, it } from "vitest";
import { Connector, Database, createDatabase } from "../../src";

export function testConnector(opts: { connector: Connector }) {
  let db: Database;
  beforeAll(() => {
    db = createDatabase(opts.connector);
  });

  it("drop and create table", async () => {
    await db.exec(`DROP TABLE IF EXISTS users`);
    const res = await db.exec(
      `CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`
    );
    expect(res).toBeDefined();
  });

  it("insert", async () => {
    const res = await db
      .prepare("INSERT INTO users VALUES (?, 'John', 'Doe', '')")
      .run("123");
    expect(res).toBeDefined();
  });

  it("select", async () => {
    const row = await db.prepare("SELECT * FROM users WHERE id = ?").get("123");
    expect(row).toMatchInlineSnapshot(`
      {
        "email": "",
        "firstName": "John",
        "id": "123",
        "lastName": "Doe",
      }
    `);
  });
}
