import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database, createDatabase } from "../../../src";

import postgresql from "../../../src/connectors/postgresql";

import { DrizzleDatabase, drizzle } from "../../../src/integrations/drizzle";
import { numeric, pgTable, text } from "drizzle-orm/pg-core";

describe.runIf(process.env.POSTGRESQL_URL)("integrations: drizzle: postgres", () => {
  const users = pgTable("users", {
    id: numeric('id'),
    name: text("name"),
  });

  let drizzleDb: DrizzleDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(postgresql({
      url: process.env.POSTGRESQL_URL as string,
    }));
    
    drizzleDb = drizzle(db);
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE users ("id" INTEGER PRIMARY KEY, "name" TEXT)`;;
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
