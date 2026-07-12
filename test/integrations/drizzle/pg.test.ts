import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, relations, sql } from "drizzle-orm";

import { type Connector, Database, createDatabase } from "../../../src";
import {
  type DrizzlePgDatabase,
  drizzle as drizzlePg,
} from "../../../src/integrations/drizzle/postgres";

import * as dPg from "drizzle-orm/pg-core";
import pgliteConnector from "../../../src/connectors/pglite";
import pgConnector from "../../../src/connectors/postgresql";

const users = dPg.pgTable("users", {
  id: dPg.serial("id").primaryKey(),
  name: dPg.text("name"),
});

const connectors: {
  name: string;
  connector: () => Connector;
  runIf?: boolean;
}[] = [
  {
    name: "pglite",
    connector: () => pgliteConnector({}),
  },
  {
    name: "postgresql",
    connector: () => pgConnector({ url: process.env.POSTGRESQL_URL as string }),
    runIf: !!process.env.POSTGRESQL_URL,
  },
];

const events = dPg.pgTable("events_cc", {
  id: dPg.serial("id").primaryKey(),
  fooBar: dPg.integer("foo_bar"),
  createdAt: dPg.text("created_at"),
  userFullName: dPg.text("user_full_name"),
});

for (const { name, connector, runIf } of connectors) {
  const describeFn = runIf === false ? describe.skip : describe;

  describeFn(`integrations: drizzle: ${name}`, () => {
    let drizzleDb: DrizzlePgDatabase;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(connector());
      drizzleDb = drizzlePg(db);
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`;
    });

    it("insert", async () => {
      const res = await drizzleDb
        .insert(users)
        .values({ name: "John Doe" })
        .returning();

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

      const res = await drizzleDb.select().from(users);
      expect(res.some((r) => r.name === "Outer TX")).toBe(true);
      expect(res.some((r) => r.name === "Inner TX")).toBe(false);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.dispose();
    });
  });
}

describe("integrations: drizzle: column name remapping (PostgreSQL/PGLite)", () => {
  let drizzleDb: DrizzlePgDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(pgliteConnector({}));
    drizzleDb = drizzlePg(db);
    await db.sql`DROP TABLE IF EXISTS events_cc`;
    await db.sql`CREATE TABLE events_cc (
      id SERIAL PRIMARY KEY,
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
    await db.dispose();
  });
});

describe("integrations: drizzle: relational queries & raw SQL (PostgreSQL/PGLite)", () => {
  const authors = dPg.pgTable("authors", {
    id: dPg.serial("id").primaryKey(),
    name: dPg.text("name"),
  });
  const books = dPg.pgTable("books", {
    id: dPg.serial("id").primaryKey(),
    authorId: dPg.integer("author_id"),
    title: dPg.text("title"),
  });
  const authorsRelations = relations(authors, ({ many }) => ({
    books: many(books),
  }));
  const booksRelations = relations(books, ({ one }) => ({
    author: one(authors, {
      fields: [books.authorId],
      references: [authors.id],
    }),
  }));
  const schema = { authors, books, authorsRelations, booksRelations };

  let drizzleDb: DrizzlePgDatabase<typeof schema>;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(pgliteConnector({}));
    drizzleDb = drizzlePg(db, { schema });
    await db.sql`DROP TABLE IF EXISTS books`;
    await db.sql`DROP TABLE IF EXISTS authors`;
    await db.sql`CREATE TABLE authors (id SERIAL PRIMARY KEY, name TEXT)`;
    await db.sql`CREATE TABLE books (id SERIAL PRIMARY KEY, author_id INTEGER, title TEXT)`;
    await drizzleDb.insert(authors).values({ name: "Ada" });
    await drizzleDb.insert(books).values({ authorId: 1, title: "First" });
    await drizzleDb.insert(books).values({ authorId: 1, title: "Second" });
  });

  it("relational findMany with nested relation", async () => {
    const res = await drizzleDb.query.authors.findMany({
      with: { books: true },
    });
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe("Ada");
    expect(res[0].books.map((b) => b.title)).toEqual(["First", "Second"]);
  });

  it("relational findFirst with nested relation", async () => {
    const res = await drizzleDb.query.books.findFirst({
      with: { author: true },
    });
    expect(res?.title).toBe("First");
    expect(res?.author?.name).toBe("Ada");
  });

  it("bare sql aggregate select", async () => {
    const res = await drizzleDb
      .select({ total: sql<number>`count(*)` })
      .from(books);
    expect(Number(res[0].total)).toBe(2);
  });

  it("$count() (values path)", async () => {
    const total = await drizzleDb.$count(books);
    expect(Number(total)).toBe(2);
  });

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS books`;
    await db.sql`DROP TABLE IF EXISTS authors`;
    await db.dispose();
  });
});
