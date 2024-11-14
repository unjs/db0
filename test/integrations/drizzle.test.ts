import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Database } from "../../src";
import { type DrizzleDatabase, drizzle } from "../../src/integrations/drizzle";

import * as dSqlite from "drizzle-orm/sqlite-core";
import sqliteConnector from "../../src/connectors/better-sqlite3";

import * as dPg from "drizzle-orm/pg-core";
import pgConnector from "../../src/connectors/postgresql";
import { getCreateDatabaseMock } from "../connectors/mocks";


vi.mock('../../src/integrations/drizzle', () => ({
  drizzle: vi.fn().mockReturnValue({
    sql: vi.fn().mockImplementation((query) => {
      // Handle various SQL queries
      if (query.includes('DROP TABLE')) {
        return Promise.resolve();
      }
      if (query.includes('CREATE TABLE')) {
        return Promise.resolve();
      }
      if (query.includes('INSERT INTO users')) {
        // Simulate insert operation
        return Promise.resolve([{ id: 1, name: 'John Doe' }]);
      }
      if (query.includes('SELECT * FROM users')) {
        // Simulate select operation
        return Promise.resolve([{ id: 1, name: 'John Doe' }]);
      }
      return Promise.resolve();
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 1, name: 'John Doe' }]), // Mock returning inserted rows
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue([{ id: 1, name: 'John Doe' }]), // Mock select results
      }),
    }),
  }),
}));

describe("integrations: drizzle: better-sqlite3", () => {
  const users = dSqlite.sqliteTable("users", {
    id: dSqlite.numeric("id"),
    name: dSqlite.text("name"),
  });

  let drizzleDb: DrizzleDatabase;
  let db: Database;

  beforeAll(async () => {
    // Mock the module before importing
    vi.mock('../../src', () => getCreateDatabaseMock());

    // Lazily import the module after mocking (this is necessary to avoid errors)
    const { createDatabase } = await import('../../src');

    // Initialize the database after the module has been imported and mock is applied
    db = createDatabase(sqliteConnector({}));
    drizzleDb = drizzle(db);
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
    // Mock the module before importing
    vi.mock('../../src', () => getCreateDatabaseMock());

    // Lazily import the module after mocking (this is necessary to avoid errors)
    const { createDatabase } = await import('../../src');

    // Initialize the database after the module has been imported and mock is applied
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
