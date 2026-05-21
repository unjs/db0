import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

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

const events = dMySql.mysqlTable("events_cc", {
  id: dMySql.int("id").primaryKey().autoincrement(),
  fooBar: dMySql.int("foo_bar"),
  createdAt: dMySql.varchar("created_at", { length: 64 }),
  userFullName: dMySql.varchar("user_full_name", { length: 255 }),
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

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzle: column name remapping (MySQL)",
  () => {
    let drizzleDb: DrizzleMySqlDatabase;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(
        mysql2Connector({ uri: process.env.MYSQL_URL as string }),
      );
      drizzleDb = drizzleMySql(db);
      await db.sql`DROP TABLE IF EXISTS events_cc`;
      await db.sql`CREATE TABLE events_cc (
        id INT PRIMARY KEY AUTO_INCREMENT,
        foo_bar INT,
        created_at VARCHAR(64),
        user_full_name VARCHAR(255)
      )`;
      await drizzleDb.insert(events).values({
        fooBar: 1,
        createdAt: "2024-01-01",
        userFullName: "John Doe",
      });
      await drizzleDb.insert(events).values({
        fooBar: 2,
        createdAt: "2024-06-15",
        userFullName: "Jane Smith",
      });
    });

    it("select returns camelCase keys, not snake_case", async () => {
      const res = await drizzleDb.select().from(events);
      expect(res.length).toBe(2);
      expect(res[0]).toHaveProperty("fooBar");
      expect(res[0]).toHaveProperty("createdAt");
      expect(res[0]).toHaveProperty("userFullName");
      expect(res[0]).not.toHaveProperty("foo_bar");
      expect(res[0]).not.toHaveProperty("created_at");
      expect(res[0]).not.toHaveProperty("user_full_name");
      expect(res[0].fooBar).toBe(1);
    });

    it("where eq() on remapped column works and returns camelCase keys", async () => {
      const res = await drizzleDb
        .select()
        .from(events)
        .where(eq(events.fooBar, 1));
      expect(res.length).toBe(1);
      expect(res[0]).toHaveProperty("fooBar");
      expect(res[0]).not.toHaveProperty("foo_bar");
      expect(res[0].fooBar).toBe(1);
      expect(res[0].userFullName).toBe("John Doe");
    });

    it("all remapped columns use camelCase keys", async () => {
      const res = await drizzleDb.select().from(events);
      for (const row of res) {
        expect(Object.keys(row)).toEqual(
          expect.arrayContaining(["id", "fooBar", "createdAt", "userFullName"]),
        );
        expect(Object.keys(row)).not.toEqual(
          expect.arrayContaining(["foo_bar", "created_at", "user_full_name"]),
        );
      }
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS events_cc`;
      await db.dispose();
    });
  },
);
