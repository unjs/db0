import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defineRelations } from "drizzle-orm";

import type { Cache } from "drizzle-orm/cache/core";
import * as dSqlite from "drizzle-orm/sqlite-core";
import * as dPg from "drizzle-orm/pg-core";
import * as dMySql from "drizzle-orm/mysql-core";

import {
  type Connector,
  type Database,
  type SQLDialect,
  createDatabase,
} from "../../../src";

import {
  type DrizzleBaseConfig,
  drizzle as drizzleSqlite,
} from "../../../src/integrations/drizzle";
import { drizzle as drizzlePg } from "../../../src/integrations/drizzle/postgres";
import { drizzle as drizzleMySql } from "../../../src/integrations/drizzle/mysql";

import betterSqlite3 from "../../../src/connectors/better-sqlite3";
import pgliteConnector from "../../../src/connectors/pglite";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

/**
 * A connector that never runs anything — enough for `drizzle()` and `.toSQL()`,
 * which never touch the driver.
 */
function stubDatabase(name: string, dialect: SQLDialect): Database {
  const connector: Connector = {
    name,
    dialect,
    getInstance: () => ({}),
    exec: () => ({}),
    prepare: () => {
      throw new Error(`[test] ${name} statements are not executable`);
    },
  };
  return createDatabase(connector);
}

describe("integrations: drizzle: config: casing", () => {
  // v1 removed `casing` from `DrizzleConfig`, so TypeScript only rejects it for
  // inline object literals. Anything assembled in a variable or forwarded by a
  // framework wrapper still type-checks and would silently emit `"fullName"`
  // instead of `"full_name"`.
  const strayCasing = { casing: "snake_case" } as any;

  it("sqlite drizzle() rejects a stray `casing` option", () => {
    const db = stubDatabase("better-sqlite3", "sqlite");
    expect(() => drizzleSqlite(db, strayCasing)).toThrow(/`casing`/);
    expect(() => drizzleSqlite(db, strayCasing)).toThrow(/snakeCase\.table/);
  });

  it("postgres drizzle() rejects a stray `casing` option", () => {
    const db = stubDatabase("postgresql", "postgresql");
    expect(() => drizzlePg(db, strayCasing)).toThrow(/`casing`/);
  });

  it("mysql drizzle() rejects a stray `casing` option", () => {
    const db = stubDatabase("mysql", "mysql");
    expect(() => drizzleMySql(db, strayCasing)).toThrow(/`casing`/);
  });

  it("accepts a config without `casing`", () => {
    const db = stubDatabase("better-sqlite3", "sqlite");
    expect(() => drizzleSqlite(db, { logger: false })).not.toThrow();
  });

  it("still generates quoted snake_case SQL from the schema helpers", () => {
    const profiles = dSqlite.sqliteTable("profiles", {
      id: dSqlite.integer("id"),
      fullName: dSqlite.text("full_name"),
    });
    const db = stubDatabase("better-sqlite3", "sqlite");
    const { sql } = drizzleSqlite(db).select().from(profiles).toSQL();
    expect(sql).toContain('"full_name"');
    expect(sql).not.toContain('"fullName"');
  });
});

describe("integrations: drizzle: config: $cache and $client", () => {
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(betterSqlite3({ name: ":memory:" }));
    await db.sql`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`;
  });

  afterAll(async () => {
    await db.dispose();
  });

  function fakeCache(): Cache {
    return {
      strategy: () => "explicit",
      get: async () => undefined,
      put: async () => {},
      onMutate: vi.fn(async () => {}),
    } as unknown as Cache;
  }

  it("exposes the configured cache as `$cache`", () => {
    const cache = fakeCache();
    const d = drizzleSqlite(db, { cache });
    expect(d.$cache).toBe(cache);
  });

  it("`$cache.invalidate()` calls the cache's `onMutate`", async () => {
    const cache = fakeCache();
    const d = drizzleSqlite(db, { cache });

    await d.$cache.invalidate({ tables: ["users"] });

    expect(cache.onMutate).toHaveBeenCalledTimes(1);
    expect(cache.onMutate).toHaveBeenCalledWith({ tables: ["users"] });
  });

  it("keeps drizzle's no-op `$cache` when no cache is configured", async () => {
    const d = drizzleSqlite(db);
    await expect(d.$cache.invalidate({ tables: ["users"] })).resolves.toBe(
      undefined,
    );
  });

  it("`$client` is the db0 database", () => {
    expect(drizzleSqlite(db).$client).toBe(db);
    expect(drizzlePg(stubDatabase("pglite", "postgresql")).$client).toBeTypeOf(
      "object",
    );
  });

  it("wires `$cache` for postgres and mysql too", async () => {
    const pgCache = fakeCache();
    const pgDb = drizzlePg(stubDatabase("pglite", "postgresql"), {
      cache: pgCache,
    });
    await pgDb.$cache.invalidate({ tables: ["users"] });
    expect(pgCache.onMutate).toHaveBeenCalledTimes(1);

    const mysqlCache = fakeCache();
    const mysqlDb = drizzleMySql(stubDatabase("mysql", "mysql"), {
      cache: mysqlCache,
    });
    await mysqlDb.$cache.invalidate({ tables: ["users"] });
    expect(mysqlCache.onMutate).toHaveBeenCalledTimes(1);
  });
});

describe("integrations: drizzle: config: forbidJsonb", () => {
  const authors = dSqlite.sqliteTable("authors", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    name: dSqlite.text("name"),
  });
  const books = dSqlite.sqliteTable("books", {
    id: dSqlite.integer("id").primaryKey({ autoIncrement: true }),
    authorId: dSqlite.integer("author_id"),
    title: dSqlite.text("title"),
  });
  const relations = defineRelations({ authors, books }, (r) => ({
    authors: { books: r.many.books() },
    books: {
      author: r.one.authors({ from: r.books.authorId, to: r.authors.id }),
    },
  }));

  const relationalSql = (db: Database, forbidJsonb?: boolean) =>
    drizzleSqlite(db, { relations, forbidJsonb })
      .query.authors.findMany({
        with: { books: true },
      })
      .toSQL().sql;

  it("uses `jsonb_*` helpers on SQLite builds that have JSONB", () => {
    const sql = relationalSql(stubDatabase("better-sqlite3", "sqlite"));
    expect(sql).toMatch(/jsonb_/);
  });

  it("uses `json_*` helpers for the cloudflare-d1 connector", () => {
    const sql = relationalSql(stubDatabase("cloudflare-d1", "sqlite"));
    expect(sql).not.toMatch(/jsonb_/);
    expect(sql).toMatch(/json_/);
  });

  it("uses `json_*` helpers when `forbidJsonb` is set explicitly", () => {
    const sql = relationalSql(stubDatabase("better-sqlite3", "sqlite"), true);
    expect(sql).not.toMatch(/jsonb_/);
    expect(sql).toMatch(/json_/);
  });

  // A transaction is its own `SQLiteAsyncDatabase`, so it carries its own
  // `forbidJsonb`: without threading it through the session, `tx.query.*` would
  // still emit `jsonb_*` on a connector whose SQLite build has no JSONB.
  it("keeps `json_*` helpers inside a transaction", async () => {
    const db = createDatabase(betterSqlite3({ name: ":memory:" }));
    const drizzleDb = drizzleSqlite(db, { relations, forbidJsonb: true });
    const sql = await drizzleDb.transaction(
      async (tx) =>
        tx.query.authors.findMany({ with: { books: true } }).toSQL().sql,
    );
    expect(sql).not.toMatch(/jsonb_/);
    expect(sql).toMatch(/json_/);
    await db.dispose();
  });
});

describe("integrations: drizzle: config: types", () => {
  // `DrizzleSQLiteConfig` has no default type argument, so re-exporting it
  // directly as `DrizzleBaseConfig` breaks every downstream `DrizzleBaseConfig`
  // used without one. The test suite is not type-checked by `pnpm test:types`
  // (its tsconfig only includes `src`), so compile the snippet here.
  it("`DrizzleBaseConfig` works without a type argument and the per-dialect config types stay exported", () => {
    const dir = mkdtempSync(join(REPO_ROOT, "test", "integrations", ".types-"));
    try {
      const file = join(dir, "probe.ts");
      const entry = (...segments: string[]) =>
        relative(
          dir,
          join(REPO_ROOT, "src", "integrations", "drizzle", ...segments),
        ).replaceAll("\\", "/");
      writeFileSync(
        file,
        [
          `import type { DrizzleBaseConfig } from "./${entry("index.ts")}";`,
          `import type { DrizzleSQLiteConfig } from "./${entry("sqlite", "index.ts")}";`,
          `import type { DrizzlePgConfig } from "./${entry("postgres", "index.ts")}";`,
          `import type { DrizzleMySqlConfig } from "./${entry("mysql", "index.ts")}";`,
          `const config: DrizzleBaseConfig = { logger: true };`,
          `export type Configs = [DrizzleSQLiteConfig<any>, DrizzlePgConfig<any>, DrizzleMySqlConfig<any>];`,
          `export default config;`,
          "",
        ].join("\n"),
      );

      expect(() =>
        execFileSync(
          join(REPO_ROOT, "node_modules", ".bin", "tsc"),
          [
            "--ignoreConfig",
            "--noEmit",
            "--target",
            "esnext",
            "--module",
            "nodenext",
            "--moduleResolution",
            "nodenext",
            "--strict",
            "--skipLibCheck",
            "--allowImportingTsExtensions",
            file,
          ],
          { cwd: REPO_ROOT, stdio: "pipe" },
        ),
      ).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("`DrizzleBaseConfig` is assignable at runtime", () => {
    const config: DrizzleBaseConfig = { logger: false };
    expect(config.logger).toBe(false);
  });
});

describe("integrations: drizzle: config: codecs (pglite)", () => {
  const codecs = dPg.pgTable("codecs", {
    id: dPg.serial("id").primaryKey(),
    num: dPg.numeric("num", { precision: 12, scale: 2, mode: "number" }),
    bigBig: dPg.bigint("big_big", { mode: "bigint" }),
    bigNum: dPg.bigint("big_num", { mode: "number" }),
    day: dPg.date("day"),
    ts: dPg.timestamp("ts"),
    tsString: dPg.timestamp("ts_string", { mode: "string" }),
    tstz: dPg.timestamp("tstz", { withTimezone: true }),
    flag: dPg.boolean("flag"),
    iv: dPg.interval("iv"),
  });

  let db: Database;
  let row: typeof codecs.$inferSelect;

  beforeAll(async () => {
    db = createDatabase(pgliteConnector({}));
    await db.sql`CREATE TABLE codecs (
      id SERIAL PRIMARY KEY,
      num NUMERIC(12, 2),
      big_big BIGINT,
      big_num BIGINT,
      day DATE,
      ts TIMESTAMP,
      ts_string TIMESTAMP,
      tstz TIMESTAMPTZ,
      flag BOOLEAN,
      iv INTERVAL
    )`;
    await db.exec(
      `INSERT INTO codecs (num, big_big, big_num, day, ts, ts_string, tstz, flag, iv)
       VALUES (12.34, 9007199254740993, 42, '2024-01-02', '2024-01-02 03:04:05',
               '2024-01-02 03:04:05', '2024-01-02 03:04:05+00', true, '1 day')`,
    );

    const rows = await drizzlePg(db).select().from(codecs);
    row = rows[0]!;
  });

  afterAll(async () => {
    await db.dispose();
  });

  it("decodes numeric({ mode: 'number' }) to a number", () => {
    expect(row.num).toBe(12.34);
  });

  it("decodes bigint({ mode: 'bigint' }) to a BigInt without losing precision", () => {
    expect(row.bigBig).toBe(9_007_199_254_740_993n);
  });

  it("decodes bigint({ mode: 'number' }) to a JSON-serializable number", () => {
    expect(row.bigNum).toBe(42);
    expect(() => JSON.stringify(row.bigNum)).not.toThrow();
  });

  it("decodes timestamp columns independently of the driver's parsers", () => {
    expect(row.ts).toBeInstanceOf(Date);
    expect((row.ts as Date).toISOString()).toBe("2024-01-02T03:04:05.000Z");
    expect(row.tstz).toBeInstanceOf(Date);
    expect((row.tstz as Date).toISOString()).toBe("2024-01-02T03:04:05.000Z");
  });

  it("decodes timestamp({ mode: 'string' }) to a string", () => {
    expect(row.tsString).toBe("2024-01-02 03:04:05");
  });

  it("decodes date and interval the way drizzle's own pglite driver does", () => {
    expect(row.day).toBe("2024-01-02");
    expect(row.iv).toBe("1 day");
  });

  it("decodes boolean to a boolean", () => {
    expect(row.flag).toBe(true);
  });
});

describe("integrations: drizzle: config: codecs (mysql)", () => {
  const codecs = dMySql.mysqlTable("codecs", {
    id: dMySql.int("id"),
    flag: dMySql.boolean("flag"),
    dt: dMySql.datetime("dt"),
    dtString: dMySql.datetime("dt_string", { mode: "string" }),
    ts: dMySql.timestamp("ts"),
    day: dMySql.date("day"),
    bigBig: dMySql.bigint("big_big", { mode: "bigint" }),
    bigNum: dMySql.bigint("big_num", { mode: "number" }),
    dec: dMySql.decimal("dec", { mode: "number" }),
  });

  /**
   * What `mysql2` hands db0 back for the query below. Unaliased expressions
   * keep their SQL text as the column name, which is why the cast columns are
   * keyed the way they are.
   */
  const driverRow: Record<string, unknown> = {
    id: 1,
    flag: 1,
    "cast(`dt` as char)": "2024-01-02 03:04:05",
    "cast(`dt_string` as char)": "2024-01-02 03:04:05",
    "cast(`ts` as char)": "2024-01-02 03:04:05",
    "cast(`day` as char)": "2024-01-02",
    "cast(`big_big` as char)": "9007199254740993",
    "cast(`big_num` as char)": "42",
    dec: "12.34",
  };

  function fakeMySqlDatabase(): Database {
    const statement = {
      bind() {
        return statement;
      },
      all: async () => [driverRow],
      get: async () => driverRow,
      run: async () => ({ success: true }),
    };
    return createDatabase({
      name: "mysql",
      dialect: "mysql",
      getInstance: () => ({}),
      exec: () => ({}),
      prepare: () => statement,
    } as unknown as Connector);
  }

  it("asks MySQL for text so decoding does not depend on connection options", () => {
    const { sql } = drizzleMySql(fakeMySqlDatabase())
      .select()
      .from(codecs)
      .toSQL();
    expect(sql).toContain("cast(`dt` as char)");
    expect(sql).toContain("cast(`big_big` as char)");
  });

  it("decodes a mysql2 row to the column's $inferSelect types", async () => {
    const rows = await drizzleMySql(fakeMySqlDatabase()).select().from(codecs);
    const row = rows[0]!;

    expect(row.flag).toBe(true);
    expect(row.dt).toBeInstanceOf(Date);
    expect((row.dt as Date).toISOString()).toBe("2024-01-02T03:04:05.000Z");
    expect(row.dtString).toBe("2024-01-02 03:04:05");
    expect(row.ts).toBeInstanceOf(Date);
    expect((row.ts as Date).toISOString()).toBe("2024-01-02T03:04:05.000Z");
    expect(row.day).toBeInstanceOf(Date);
    expect((row.day as Date).toISOString()).toBe("2024-01-02T00:00:00.000Z");
    expect(row.bigBig).toBe(9_007_199_254_740_993n);
    expect(row.bigNum).toBe(42);
    expect(row.dec).toBe(12.34);
  });
});
