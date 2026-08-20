import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, relations, sql } from "drizzle-orm";

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

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzle: relational queries & raw SQL (MySQL)",
  () => {
    const authors = dMySql.mysqlTable("authors", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      name: dMySql.text("name"),
    });
    const books = dMySql.mysqlTable("books", {
      id: dMySql.int("id").primaryKey().autoincrement(),
      authorId: dMySql.int("author_id"),
      title: dMySql.text("title"),
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

    let drizzleDb: DrizzleMySqlDatabase<typeof schema>;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(
        mysql2Connector({ uri: process.env.MYSQL_URL as string }),
      );
      drizzleDb = drizzleMySql(db, { schema, mode: "default" });
      await db.sql`DROP TABLE IF EXISTS books`;
      await db.sql`DROP TABLE IF EXISTS authors`;
      await db.sql`CREATE TABLE authors (id INT PRIMARY KEY AUTO_INCREMENT, name TEXT)`;
      await db.sql`CREATE TABLE books (id INT PRIMARY KEY AUTO_INCREMENT, author_id INT, title TEXT)`;
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
      await db.dispose();
    });
  },
);

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzle: joins, decoders & casing (MySQL)",
  () => {
    const jUsers = dMySql.mysqlTable("j_users", {
      id: dMySql.int("id").primaryKey(),
      name: dMySql.varchar("name", { length: 255 }),
    });
    const jPosts = dMySql.mysqlTable("j_posts", {
      id: dMySql.int("id").primaryKey(),
      userId: dMySql.int("user_id"),
      name: dMySql.varchar("name", { length: 255 }),
    });
    const jTags = dMySql.mysqlTable("j_tags", {
      tagId: dMySql.int("tag_id").primaryKey(),
      tagUserId: dMySql.int("tag_user_id"),
      label: dMySql.varchar("label", { length: 255 }),
    });

    let drizzleDb: DrizzleMySqlDatabase;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(
        mysql2Connector({ uri: process.env.MYSQL_URL as string }),
      );
      drizzleDb = drizzleMySql(db);
      await db.sql`DROP TABLE IF EXISTS j_users`;
      await db.sql`DROP TABLE IF EXISTS j_posts`;
      await db.sql`DROP TABLE IF EXISTS j_tags`;
      await db.sql`CREATE TABLE j_users (id INT PRIMARY KEY, name VARCHAR(255))`;
      await db.sql`CREATE TABLE j_posts (id INT PRIMARY KEY, user_id INT, name VARCHAR(255))`;
      await db.sql`CREATE TABLE j_tags (tag_id INT PRIMARY KEY, tag_user_id INT, label VARCHAR(255))`;
      await db.sql`INSERT INTO j_users VALUES (1, 'Ada'), (2, 'Grace')`;
      await db.sql`INSERT INTO j_posts VALUES (10, 1, 'First post')`;
      await db.sql`INSERT INTO j_tags VALUES (7, 1, 'pioneer')`;
    });

    it("left join nests both tables and nulls unmatched rows", async () => {
      const res = await drizzleDb
        .select()
        .from(jUsers)
        .leftJoin(jTags, eq(jTags.tagUserId, jUsers.id))
        .orderBy(jUsers.id);

      expect(res).toEqual([
        {
          j_users: { id: 1, name: "Ada" },
          j_tags: { tagId: 7, tagUserId: 1, label: "pioneer" },
        },
        { j_users: { id: 2, name: "Grace" }, j_tags: null },
      ]);
    });

    it("throws instead of returning wrong values for ambiguous columns", async () => {
      await expect(
        (async () =>
          drizzleDb
            .select()
            .from(jUsers)
            .leftJoin(jPosts, eq(jPosts.userId, jUsers.id)))(),
      ).rejects.toThrow(/`j_users.id` and `j_posts.id` both come back as `id`/);
    });

    it("aliased columns disambiguate a join", async () => {
      const res = await drizzleDb
        .select({
          userId: sql<number>`${jUsers.id}`.as("user_id"),
          postId: sql<number>`${jPosts.id}`.as("post_id"),
        })
        .from(jUsers)
        .leftJoin(jPosts, eq(jPosts.userId, jUsers.id))
        .orderBy(jUsers.id);

      expect(res).toEqual([
        { userId: 1, postId: 10 },
        { userId: 2, postId: null },
      ]);
    });

    it("applies decoders of sql expressions", async () => {
      const res = await drizzleDb
        .select({
          total: sql<number>`count(*)`.mapWith(Number).as("total"),
          flag: sql<boolean>`true`.mapWith(Boolean).as("flag"),
        })
        .from(jUsers);

      expect(res[0].total).toBe(2);
      expect(res[0].flag).toBe(true);
    });

    it("resolves column names built by the casing config", async () => {
      const casingDrizzle = drizzleMySql(db, { casing: "snake_case" });
      const profiles = dMySql.mysqlTable("profiles", {
        id: dMySql.int(),
        fullName: dMySql.varchar({ length: 255 }),
      });

      await db.sql`DROP TABLE IF EXISTS profiles`;
      await db.sql`CREATE TABLE profiles (id INT PRIMARY KEY, full_name VARCHAR(255))`;
      await db.sql`INSERT INTO profiles VALUES (1, 'Ada')`;

      expect(await casingDrizzle.select().from(profiles)).toEqual([
        { id: 1, fullName: "Ada" },
      ]);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS j_users`;
      await db.sql`DROP TABLE IF EXISTS j_posts`;
      await db.sql`DROP TABLE IF EXISTS j_tags`;
      await db.sql`DROP TABLE IF EXISTS profiles`;
      await db.dispose();
    });
  },
);
