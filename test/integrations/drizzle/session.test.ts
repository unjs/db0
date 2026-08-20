import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import * as dMySql from "drizzle-orm/mysql-core";
import * as dPg from "drizzle-orm/pg-core";

import {
  type Connector,
  type Database,
  type Primitive,
  type SQLDialect,
  createDatabase,
} from "../../../src";
import { drizzle as drizzleSqlite } from "../../../src/integrations/drizzle/sqlite";
import {
  type DrizzlePgDatabase,
  drizzle as drizzlePg,
} from "../../../src/integrations/drizzle/postgres";
import { drizzle as drizzleMySql } from "../../../src/integrations/drizzle/mysql";

import pgliteConnector from "../../../src/connectors/pglite";

type Query = (sql: string, params: Primitive[]) => unknown;

type RecordedCall = { method: "all" | "run" | "get"; sql: string };

/**
 * A connector that answers from `query()` instead of a database, so a session
 * can be driven into states a real driver only reaches on a broken connection.
 * `run()` spreads the driver result on top of `{ success }`, the same way the
 * mysql2, pglite and postgresql connectors do.
 */
function fakeConnector(
  dialect: SQLDialect,
  query: Query,
): Connector & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const prepare = (sql: string) => {
    const record = async (
      method: RecordedCall["method"],
      params: Primitive[],
    ) => {
      calls.push({ method, sql });
      return query(sql, params);
    };
    const statement = {
      bind: (...params: Primitive[]) => ({
        bind: statement.bind,
        all: () => statement.all(...params),
        run: () => statement.run(...params),
        get: () => statement.get(...params),
      }),
      all: async (...params: Primitive[]) =>
        (await record("all", params)) as unknown[],
      run: async (...params: Primitive[]) => ({
        success: true,
        ...(await record("run", params)),
      }),
      get: async (...params: Primitive[]) =>
        ((await record("get", params)) as unknown[])?.[0],
    };
    return statement;
  };

  return {
    name: "fake",
    dialect,
    calls,
    getInstance: () => ({}),
    exec: (sql: string) => query(sql, []),
    prepare,
  };
}

/** Rejects the rollback (and only the rollback), like a dropped connection. */
const failingRollback: Query = (sql) => {
  if (/^rollback|^release/i.test(sql)) {
    throw new Error("ROLLBACK-FAILED");
  }
  return [];
};

/** The message of every error in the `cause` chain of `error`. */
function causeChain(error: unknown): string[] {
  const messages: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    messages.push(current.message);
    current = current.cause;
  }
  return messages;
}

const dialects: {
  name: string;
  dialect: SQLDialect;
  drizzle: (db: Database) => {
    transaction: (
      transaction: (tx: any) => Promise<unknown>,
    ) => Promise<unknown>;
  };
}[] = [
  { name: "sqlite", dialect: "sqlite", drizzle: drizzleSqlite },
  { name: "postgres", dialect: "postgresql", drizzle: drizzlePg },
  { name: "mysql", dialect: "mysql", drizzle: drizzleMySql },
];

for (const { name, dialect, drizzle } of dialects) {
  describe(`integrations: drizzle: ${name} session`, () => {
    it("keeps the original error when the rollback fails", async () => {
      const db = createDatabase(fakeConnector(dialect, failingRollback));
      const drizzleDb = drizzle(db);

      const error = await drizzleDb
        .transaction(async () => {
          throw new Error("ORIGINAL-BUSINESS-ERROR");
        })
        .then(
          () => undefined,
          (error_) => error_ as Error,
        );

      expect(error?.message).toBe("ORIGINAL-BUSINESS-ERROR");
      // The rollback failure is reported, not swallowed and not promoted.
      expect(causeChain(error)).toContain("ROLLBACK-FAILED");
    });

    it("keeps the original error when a savepoint rollback fails", async () => {
      const db = createDatabase(fakeConnector(dialect, failingRollback));
      const drizzleDb = drizzle(db);

      const error = await drizzleDb
        .transaction(async (tx) =>
          tx.transaction(async () => {
            throw new Error("ORIGINAL-BUSINESS-ERROR");
          }),
        )
        .then(
          () => undefined,
          (error_) => error_ as Error,
        );

      expect(error?.message).toBe("ORIGINAL-BUSINESS-ERROR");
      expect(causeChain(error)).toContain("ROLLBACK-FAILED");
    });
  });
}

describe("integrations: drizzle: mysql session (mysql2-shaped connector)", () => {
  const users = dMySql.mysqlTable("users", {
    id: dMySql.int("id").primaryKey().autoincrement(),
    name: dMySql.text("name"),
  });

  /**
   * mysql2 hands back rows for a select and a `ResultSetHeader` — an object,
   * not an iterable row array — for insert/update/delete.
   */
  const mysql2Shaped: Query = (sql) => {
    if (/^select/i.test(sql)) {
      return [
        { id: 1, name: "Ada" },
        { id: 2, name: "Grace" },
      ];
    }
    return { affectedRows: 1, insertId: 7, changedRows: 0, warningStatus: 0 };
  };

  it("surfaces affected rows of a non-returning insert via run()", async () => {
    const connector = fakeConnector("mysql", mysql2Shaped);
    const drizzleDb = drizzleMySql(createDatabase(connector));

    const res = await drizzleDb.insert(users).values({ name: "Ada" });

    expect(res.affectedRows).toBe(1);
    expect(res.insertId).toBe(7);
    expect(
      connector.calls.filter((call) => /^insert/i.test(call.sql)),
    ).toMatchObject([{ method: "run" }]);
  });

  it("surfaces affected rows of an update and a delete via run()", async () => {
    const connector = fakeConnector("mysql", mysql2Shaped);
    const drizzleDb = drizzleMySql(createDatabase(connector));

    expect(
      (await drizzleDb.update(users).set({ name: "Ada" })).affectedRows,
    ).toBe(1);
    expect((await drizzleDb.delete(users)).affectedRows).toBe(1);
    expect(connector.calls.map((call) => call.method)).toEqual(["run", "run"]);
  });

  it("rejects iterator() on a statement that returns no rows", async () => {
    const drizzleDb = drizzleMySql(
      createDatabase(fakeConnector("mysql", mysql2Shaped)),
    );

    const error = await (async () => {
      try {
        for await (const _row of drizzleDb
          .insert(users)
          .values({ name: "Ada" })
          .iterator()) {
          // no rows to iterate
        }
      } catch (error_) {
        return error_ as Error;
      }
    })();

    // drizzle wraps anything thrown while running a query, so the db0 message
    // arrives as the cause.
    expect(causeChain(error).join("\n")).toMatch(
      /\[db0] \[drizzle] `iterator\(\)` is not supported for `insert` statements/,
    );
  });

  it("iterates the rows of a select", async () => {
    const drizzleDb = drizzleMySql(
      createDatabase(fakeConnector("mysql", mysql2Shaped)),
    );

    const names: unknown[] = [];
    for await (const row of drizzleDb.select().from(users).iterator()) {
      names.push(row.name);
    }

    expect(names).toEqual(["Ada", "Grace"]);
  });
});

describe("integrations: drizzle: postgres session (PGlite)", () => {
  const users = dPg.pgTable("users_session", {
    id: dPg.serial("id").primaryKey(),
    name: dPg.text("name"),
  });

  async function setup(): Promise<{
    db: Database;
    drizzleDb: DrizzlePgDatabase;
  }> {
    const db = createDatabase(pgliteConnector({}));
    await db.sql`CREATE TABLE users_session (id SERIAL PRIMARY KEY, name TEXT)`;
    return { db, drizzleDb: drizzlePg(db) };
  }

  it("surfaces affected rows of non-returning insert/update/delete", async () => {
    const { db, drizzleDb } = await setup();

    const inserted = await drizzleDb.insert(users).values({ name: "Ada" });
    expect(inserted.rowCount).toBe(1);
    expect(inserted.affectedRows).toBe(1);

    const updated = await drizzleDb.update(users).set({ name: "Grace" });
    expect(updated.rowCount).toBe(1);

    const deleted = await drizzleDb.delete(users);
    expect(deleted.rowCount).toBe(1);

    await db.dispose();
  });

  it("still returns rows for returning() and raw execute()", async () => {
    const { db, drizzleDb } = await setup();

    const returned = await drizzleDb
      .insert(users)
      .values({ name: "Ada" })
      .returning();
    expect(returned).toEqual([{ id: 1, name: "Ada" }]);

    const executed = await drizzleDb.execute(
      sql`select name from users_session`,
    );
    // `.map()` also asserts, at compile time, that raw `execute()` still
    // resolves to rows rather than to run metadata.
    expect(executed.map((row) => row.name)).toEqual(["Ada"]);

    await db.dispose();
  });
});
