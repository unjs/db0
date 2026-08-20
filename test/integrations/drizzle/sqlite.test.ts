import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, relations, sql } from "drizzle-orm";

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
    const res = await drizzleDb.select().from(events).orderBy(events.id).all();
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

describe("integrations: drizzle: relational queries & raw SQL (SQLite)", () => {
  const authors = dSqlite.sqliteTable("authors", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name"),
  });
  const books = dSqlite.sqliteTable("books", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    authorId: dSqlite.integer("author_id"),
    title: dSqlite.text("title"),
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

  let drizzleDb: DrizzleDatabase<typeof schema>;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(betterSqlite3({ name: ":memory:" }));
    drizzleDb = drizzle(db, { schema });
    await db.sql`DROP TABLE IF EXISTS books`;
    await db.sql`DROP TABLE IF EXISTS authors`;
    await db.sql`CREATE TABLE authors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`;
    await db.sql`CREATE TABLE books (id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER, title TEXT)`;
    await drizzleDb.insert(authors).values({ name: "Ada" });
    await drizzleDb.insert(books).values({ authorId: 1, title: "First" });
    await drizzleDb.insert(books).values({ authorId: 1, title: "Second" });
  });

  it("relational findMany with nested relation", async () => {
    const res = await drizzleDb.query.authors.findMany({
      with: { books: { orderBy: books.id } },
    });
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe("Ada");
    expect(res[0].books.map((b) => b.title)).toEqual(["First", "Second"]);
  });

  it("relational findFirst with nested relation", async () => {
    const res = await drizzleDb.query.books.findFirst({
      orderBy: books.id,
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
  });
});

describe("integrations: drizzle: joins, decoders & casing (SQLite)", () => {
  const users = dSqlite.sqliteTable("j_users", {
    id: dSqlite.integer("id").primaryKey(),
    name: dSqlite.text("name"),
  });
  const posts = dSqlite.sqliteTable("j_posts", {
    id: dSqlite.integer("id").primaryKey(),
    userId: dSqlite.integer("user_id"),
    name: dSqlite.text("name"),
  });
  const tags = dSqlite.sqliteTable("j_tags", {
    tagId: dSqlite.integer("tag_id").primaryKey(),
    tagUserId: dSqlite.integer("tag_user_id"),
    label: dSqlite.text("label"),
  });

  let drizzleDb: DrizzleDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(betterSqlite3({ name: ":memory:" }));
    drizzleDb = drizzle(db);
    await db.sql`CREATE TABLE j_users (id INTEGER PRIMARY KEY, name TEXT)`;
    await db.sql`CREATE TABLE j_posts (id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT)`;
    await db.sql`CREATE TABLE j_tags (tag_id INTEGER PRIMARY KEY, tag_user_id INTEGER, label TEXT)`;
    await db.sql`INSERT INTO j_users VALUES (1, 'Ada'), (2, 'Grace')`;
    await db.sql`INSERT INTO j_posts VALUES (10, 1, 'First post')`;
    await db.sql`INSERT INTO j_tags VALUES (7, 1, 'pioneer')`;
  });

  it("left join nests both tables and nulls unmatched rows", async () => {
    const res = await drizzleDb
      .select()
      .from(users)
      .leftJoin(tags, eq(tags.tagUserId, users.id))
      .orderBy(users.id)
      .all();

    expect(res).toEqual([
      { j_users: { id: 1, name: "Ada" }, j_tags: expect.any(Object) },
      { j_users: { id: 2, name: "Grace" }, j_tags: null },
    ]);
    expect(res[0].j_tags).toEqual({ tagId: 7, tagUserId: 1, label: "pioneer" });
  });

  it("inner join keeps both sides", async () => {
    const res = await drizzleDb
      .select()
      .from(users)
      .innerJoin(tags, eq(tags.tagUserId, users.id))
      .all();

    expect(res).toEqual([
      {
        j_users: { id: 1, name: "Ada" },
        j_tags: { tagId: 7, tagUserId: 1, label: "pioneer" },
      },
    ]);
  });

  it("throws instead of returning wrong values for ambiguous columns", async () => {
    await expect(
      drizzleDb
        .select()
        .from(users)
        .leftJoin(posts, eq(posts.userId, users.id))
        .all(),
    ).rejects.toThrow(/`j_users.id` and `j_posts.id` both come back as `id`/);
  });

  it("aliased columns disambiguate a join", async () => {
    const res = await drizzleDb
      .select({
        userId: sql<number>`${users.id}`.as("user_id"),
        postId: sql<number>`${posts.id}`.as("post_id"),
      })
      .from(users)
      .leftJoin(posts, eq(posts.userId, users.id))
      .orderBy(users.id)
      .all();

    expect(res).toEqual([
      { userId: 1, postId: 10 },
      { userId: 2, postId: null },
    ]);
  });

  it("applies decoders of sql expressions", async () => {
    const res = await drizzleDb
      .select({
        total: sql<number>`count(*)`.mapWith(Number).as("total"),
        flag: sql<boolean>`1`.mapWith(Boolean).as("flag"),
      })
      .from(users)
      .all();

    expect(res[0].total).toBe(2);
    expect(res[0].flag).toBe(true);
  });

  it("applies decoders of subquery selections", async () => {
    const sub = drizzleDb
      .select({ total: sql<number>`count(*)`.mapWith(Number).as("total") })
      .from(users)
      .as("sub");
    const res = await drizzleDb.select({ total: sub.total }).from(sub).all();

    expect(res).toEqual([{ total: 2 }]);
  });

  it("resolves column names built by the casing config", async () => {
    const casingDb = createDatabase(betterSqlite3({ name: ":memory:" }));
    const casingDrizzle = drizzle(casingDb, { casing: "snake_case" });
    const profiles = dSqlite.sqliteTable("profiles", {
      id: dSqlite.integer().primaryKey(),
      fullName: dSqlite.text(),
    });

    await casingDb.sql`CREATE TABLE profiles (id INTEGER PRIMARY KEY, full_name TEXT)`;
    await casingDb.sql`INSERT INTO profiles VALUES (1, 'Ada')`;

    expect(await casingDrizzle.select().from(profiles).all()).toEqual([
      { id: 1, fullName: "Ada" },
    ]);
    expect(await casingDrizzle.select().from(profiles).get()).toEqual({
      id: 1,
      fullName: "Ada",
    });

    await casingDb.dispose();
  });

  afterAll(async () => {
    await db.dispose();
  });
});
