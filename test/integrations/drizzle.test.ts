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
  })

  it("insert", async () => {
    const res = await drizzleDb.insert(users).values({
      name: "John Doe"
    }).returning();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  })

  it("select", async () => {
    const res = await drizzleDb.select().from(users).all();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  })

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
  })
})

describe.runIf(process.env.POSTGRESQL_URL)("integrations: drizzle: postgres", () => {
  const users = dPg.pgTable("users", {
    id: dPg.numeric('id'),
    name: dPg.text("name"),
  });

  let drizzleDb: DrizzleDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(pgConnector({
      url: process.env.POSTGRESQL_URL as string,
    }));

    drizzleDb = drizzle(db);
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE users ("id" INTEGER PRIMARY KEY, "name" TEXT)`;
  })

  it("insert", async () => {
    const res = await drizzleDb.insert(users).values({
      id: "1",
      name: "John Doe"
    }).returning();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  })

  it("select", async () => {
    const res = await drizzleDb.select().from(users).all();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  })

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
  })
})
