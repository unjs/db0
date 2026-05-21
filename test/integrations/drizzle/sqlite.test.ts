import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { type Connector, Database, createDatabase } from "../../../src";
import {
  type DrizzleDatabase,
  drizzle,
} from "../../../src/integrations/drizzle";

import * as dSqlite from "drizzle-orm/sqlite-core";

import betterSqlite3 from "../../../src/connectors/better-sqlite3";
import sqlite3 from "../../../src/connectors/sqlite3";
import libsqlNode from "../../../src/connectors/libsql/node";

const connectors: { name: string; connector: () => Connector }[] = [
  {
    name: "better-sqlite3",
    connector: () => betterSqlite3({ name: ":memory:" }),
  },
  {
    name: "sqlite3",
    connector: () => sqlite3({ name: ":memory:" }),
  },
  {
    name: "libsql-node",
    connector: () => libsqlNode({ url: ":memory:" }),
  },
];

const users = dSqlite.sqliteTable("users", {
  id: dSqlite.numeric("id"),
  name: dSqlite.text("name"),
});

for (const { name, connector } of connectors) {
  describe(`integrations: drizzle: ${name}`, () => {
    let drizzleDb: DrizzleDatabase;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(connector());
      drizzleDb = drizzle(db);
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`create table if not exists users (
        id integer primary key autoincrement,
        name text
      )`;
    });

    it("insert", async () => {
      const res = await drizzleDb
        .insert(users)
        .values({
          name: "John Doe",
        })
        .returning();

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    it("select", async () => {
      const res = await drizzleDb.select().from(users).all();

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    it("accepts boolean logger config", () => {
      expect(() => drizzle(db, { logger: true })).not.toThrow();
    });

    it("transaction", async () => {
      await drizzleDb.transaction(async (tx) => {
        await tx.insert(users).values({ name: "TX User" });
      });

      const res = await drizzleDb.select().from(users).all();
      expect(res.some((r) => r.name === "TX User")).toBe(true);
    });

    it("transaction rollback", async () => {
      const countBefore = (await drizzleDb.select().from(users).all()).length;

      await expect(
        drizzleDb.transaction(async (tx) => {
          await tx.insert(users).values({ name: "Rollback User" });
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");

      const countAfter = (await drizzleDb.select().from(users).all()).length;
      expect(countAfter).toBe(countBefore);
    });

    it("nested transaction (savepoints)", async () => {
      await drizzleDb.transaction(async (tx) => {
        await tx.insert(users).values({ name: "Outer TX" });

        await expect(
          tx.transaction(async (tx2) => {
            await tx2.insert(users).values({ name: "Inner TX" });
            throw new Error("inner rollback");
          }),
        ).rejects.toThrow("inner rollback");
      });

      const res = await drizzleDb.select().from(users).all();
      expect(res.some((r) => r.name === "Outer TX")).toBe(true);
      expect(res.some((r) => r.name === "Inner TX")).toBe(false);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
    });
  });
}

describe("integrations: drizzle: with schema parameter", () => {
  const usersSchema = dSqlite.sqliteTable("users_schema", {
    id: dSqlite.numeric("id"),
    name: dSqlite.text("name"),
    email: dSqlite.text("email"),
  });

  const schema = { users: usersSchema };

  let drizzleDb: DrizzleDatabase<typeof schema>;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(betterSqlite3({ name: ":memory:" }));
    drizzleDb = drizzle(db, { schema });
    await db.sql`DROP TABLE IF EXISTS users_schema`;
    await db.sql`create table if not exists users_schema (
      id integer primary key autoincrement,
      name text,
      email text
    )`;
  });

  it("insert with schema", async () => {
    const res = await drizzleDb
      .insert(usersSchema)
      .values({
        name: "Jane Doe",
        email: "jane@example.com",
      })
      .returning();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Jane Doe");
    expect(res[0].email).toBe("jane@example.com");
  });

  it("select with schema", async () => {
    const res = await drizzleDb.select().from(usersSchema).all();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Jane Doe");
    expect(res[0].email).toBe("jane@example.com");
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users_schema`;
  });
});

describe("integrations: drizzle: column name remapping (SQLite)", () => {
  const events = dSqlite.sqliteTable("events_cc", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    fooBar: dSqlite.integer("foo_bar"),
    createdAt: dSqlite.text("created_at"),
    userFullName: dSqlite.text("user_full_name"),
  });

  let drizzleDb: DrizzleDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(betterSqlite3({ name: ":memory:" }));
    drizzleDb = drizzle(db);
    await db.sql`DROP TABLE IF EXISTS events_cc`;
    await db.sql`CREATE TABLE events_cc (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      foo_bar INTEGER,
      created_at TEXT,
      user_full_name TEXT
    )`;
    await drizzleDb
      .insert(events)
      .values({ fooBar: 1, createdAt: "2024-01-01", userFullName: "John Doe" });
    await drizzleDb.insert(events).values({
      fooBar: 2,
      createdAt: "2024-06-15",
      userFullName: "Jane Smith",
    });
  });

  it("select returns camelCase keys, not snake_case", async () => {
    const res = await drizzleDb.select().from(events).all();
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
      .where(eq(events.fooBar, 1))
      .all();
    expect(res.length).toBe(1);
    expect(res[0]).toHaveProperty("fooBar");
    expect(res[0]).not.toHaveProperty("foo_bar");
    expect(res[0].fooBar).toBe(1);
    expect(res[0].userFullName).toBe("John Doe");
  });

  it("get() returns camelCase keys", async () => {
    const res = await drizzleDb
      .select()
      .from(events)
      .where(eq(events.fooBar, 2))
      .get();
    expect(res).toBeDefined();
    expect(res).toHaveProperty("fooBar");
    expect(res).not.toHaveProperty("foo_bar");
    expect(res!.fooBar).toBe(2);
    expect(res!.userFullName).toBe("Jane Smith");
  });

  it("all remapped columns use camelCase keys", async () => {
    const res = await drizzleDb.select().from(events).all();
    for (const row of res) {
      expect(Object.keys(row)).toEqual(
        expect.arrayContaining(["id", "fooBar", "createdAt", "userFullName"]),
      );
      expect(Object.keys(row)).not.toEqual(
        expect.arrayContaining(["foo_bar", "created_at", "user_full_name"]),
      );
    }
  });

  it("insert().returning() returns camelCase keys", async () => {
    const res = await drizzleDb
      .insert(events)
      .values({ fooBar: 42, createdAt: "2025-01-01", userFullName: "Test" })
      .returning();
    expect(res.length).toBe(1);
    expect(res[0]).toHaveProperty("fooBar");
    expect(res[0]).not.toHaveProperty("foo_bar");
    expect(res[0].fooBar).toBe(42);
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS events_cc`;
  });
});
