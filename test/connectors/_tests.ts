import { beforeAll, expect, it } from "vitest";
import { Connector, Database, createDatabase } from "../../src";

export function testConnector(opts: { connector: Connector }) {
  let db: Database;
  beforeAll(() => {
    db = createDatabase(opts.connector);
  });

  it("create table", async () => {
    const res = await db.exec(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, firstName TEXT, lastName TEXT, email TEXT)"
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
