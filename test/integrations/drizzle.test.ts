import { sqliteTable, numeric, text } from "drizzle-orm/sqlite-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database, createDatabase } from "../../src";

import sqlite from "../../src/connectors/better-sqlite3";
import { DrizzleDatabase, drizzle } from "../../src/integrations/drizzle";

describe("integrations: drizzle", () => {
  const users = sqliteTable("users", {
    id: numeric("id"),
    name: text("name"),
  });

  let drizzleDb: DrizzleDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(sqlite({}));
    drizzleDb = drizzle(db);
    await db.sql`create table if not exists users (
      id integer primary key autoincrement,
      name text
    )`;
  })

  it('should insert data correctly', async () => {
    const res = await drizzleDb.insert(users).values({
      name: "John Doe"
    }).returning();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  })

  it('should read data correctly', async () => {
    const res = await drizzleDb.select().from(users).all();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  })

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
  })
})