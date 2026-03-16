import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Database, createDatabase } from "../../../src";
import {
  type DrizzleMySqlDatabase,
  drizzle as drizzleMySql,
} from "../../../src/integrations/drizzle/mysql";

import * as dMySql from "drizzle-orm/mysql-core";
import mysql2Connector from "../../../src/connectors/mysql2";

const users = dMySql.mysqlTable("users", {
  id: dMySql.int("id").primaryKey().autoincrement(),
  name: dMySql.text("name"),
});

describe.runIf(process.env.MYSQL_URL)("integrations: drizzle: mysql2", () => {
  let drizzleDb: DrizzleMySqlDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(
      mysql2Connector({
        uri: process.env.MYSQL_URL as string,
      }),
    );

    drizzleDb = drizzleMySql(db);
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE users (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT)`;
  });

  it("insert", async () => {
    await drizzleDb.insert(users).values({ name: "John Doe" });

    const res = await drizzleDb.select().from(users);
    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  it("select", async () => {
    const res = await drizzleDb.select().from(users);

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  it("transaction", async () => {
    await drizzleDb.transaction(async (tx) => {
      await tx.insert(users).values({ name: "TX User" });
    });

    const res = await drizzleDb.select().from(users);
    expect(res.some((r) => r.name === "TX User")).toBe(true);
  });

  it("transaction rollback", async () => {
    const countBefore = (await drizzleDb.select().from(users)).length;

    await expect(
      drizzleDb.transaction(async (tx) => {
        await tx.insert(users).values({ name: "Rollback User" });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    const countAfter = (await drizzleDb.select().from(users)).length;
    expect(countAfter).toBe(countBefore);
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.dispose();
  });
});
