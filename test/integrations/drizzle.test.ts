import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Database, createDatabase } from "../../src";
import { type DrizzleDatabase, drizzle } from "../../src/integrations/drizzle";
import {
  type DrizzlePgDatabase,
  drizzle as drizzlePg,
} from "../../src/integrations/drizzle/postgres";
import {
  type DrizzleMySqlDatabase,
  drizzle as drizzleMySql,
} from "../../src/integrations/drizzle/mysql";

import * as dSqlite from "drizzle-orm/sqlite-core";
import sqliteConnector from "../../src/connectors/better-sqlite3";

import * as dPg from "drizzle-orm/pg-core";
import pgConnector from "../../src/connectors/postgresql";
import pgliteConnector from "../../src/connectors/pglite";

import * as dMySql from "drizzle-orm/mysql-core";
import mysql2Connector from "../../src/connectors/mysql2";

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

describe("integrations: drizzle: pglite", () => {
  const users = dPg.pgTable("users_pg", {
    id: dPg.serial("id").primaryKey(),
    name: dPg.text("name"),
  });

  let drizzleDb: DrizzlePgDatabase;
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(pgliteConnector({}));
    drizzleDb = drizzlePg(db);
    await db.sql`DROP TABLE IF EXISTS users_pg`;
    await db.sql`CREATE TABLE users_pg (id SERIAL PRIMARY KEY, name TEXT)`;
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
    await db.sql`DROP TABLE IF EXISTS users_pg`;
    await db.dispose();
  });
});

describe.runIf(process.env.MYSQL_URL)(
  "integrations: drizzle: mysql2",
  () => {
    const users = dMySql.mysqlTable("users_mysql", {
      id: dMySql.serial("id").primaryKey(),
      name: dMySql.text("name"),
    });

    let drizzleDb: DrizzleMySqlDatabase;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(
        mysql2Connector({
          host: "localhost",
          user: "test",
          password: "test",
          database: "db0",
        }),
      );
      drizzleDb = drizzleMySql(db);
      await db.sql`DROP TABLE IF EXISTS users_mysql`;
      await db.sql`CREATE TABLE users_mysql (id INT AUTO_INCREMENT PRIMARY KEY, name TEXT)`;
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
      await db.sql`DROP TABLE IF EXISTS users_mysql`;
      await db.dispose();
    });
  },
);

describe.runIf(process.env.POSTGRESQL_URL)(
  "integrations: drizzle: postgres (external)",
  () => {
    const users = dPg.pgTable("users", {
      id: dPg.numeric("id"),
      name: dPg.text("name"),
    });

    let drizzleDb: DrizzlePgDatabase;
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({
          url: process.env.POSTGRESQL_URL as string,
        }),
      );

      drizzleDb = drizzlePg(db);
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
      const res = await drizzleDb.select().from(users);

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
    });
  },
);
