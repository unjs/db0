import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Database, createDatabase } from "../../src";
import { type DrizzleDatabase, drizzle } from "../../src/integrations/drizzle";

import * as dSqlite from "drizzle-orm/sqlite-core";
import sqliteConnector from "../../src/connectors/better-sqlite3";

import * as dPg from "drizzle-orm/pg-core";
import pgConnector from "../../src/connectors/postgresql";

describe("integrations: drizzle: better-sqlite3", () => {
  const users = dSqlite.sqliteTable("users", {
    id: dSqlite.numeric("id"),
    name: dSqlite.text("name"),
  });

  let drizzleDb: DrizzleDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
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

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
  });
});

describe("integrations: drizzle: with schema parameter", () => {
  const users = dSqlite.sqliteTable("users_schema", {
    id: dSqlite.numeric("id"),
    name: dSqlite.text("name"),
    email: dSqlite.text("email"),
  });

  const schema = { users };

  let drizzleDb: DrizzleDatabase<typeof schema>;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqliteConnector({}));
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
      .insert(users)
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
    const res = await drizzleDb.select().from(users).all();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("Jane Doe");
    expect(res[0].email).toBe("jane@example.com");
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users_schema`;
  });
});

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzle: postgres",
  () => {
    const users = dPg.pgTable("users", {
      id: dPg.numeric("id"),
      name: dPg.text("name"),
    });

    let drizzleDb: DrizzleDatabase;
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({
          url: process.env.POSTGRESQL_URL as string,
        }),
      );

      drizzleDb = drizzle(db);
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`CREATE TABLE users ("id" INTEGER PRIMARY KEY, "name" TEXT)`;
    });

    it("insert", async () => {
      const res = await drizzleDb
        .insert(users)
        .values({
          id: "1",
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

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
    });
  },
);
