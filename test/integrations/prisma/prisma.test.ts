import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ColumnTypeEnum } from "@prisma/driver-adapter-utils";

import { createDatabase, type Connector, type Database } from "../../../src";
import { prisma } from "../../../src/integrations/prisma";
import {
  columnTypes,
  getAffectedRows,
} from "../../../src/integrations/prisma/_utils";

import sqliteConnector from "../../../src/connectors/better-sqlite3";
import pgConnector from "../../../src/connectors/postgresql";

import type { PrismaClient as SqlitePrismaClient } from "./sqlite/client/client";
import type { PrismaClient as PostgresPrismaClient } from "./postgresql/client/client";

const clientDir = (provider: string) =>
  resolve(import.meta.dirname, provider, "client", "client.ts");

const CREATED_AT = new Date("2024-01-02T03:04:05.000Z");

it("column type table matches @prisma/driver-adapter-utils", () => {
  for (const [name, value] of Object.entries(columnTypes)) {
    expect(value, name).toBe(
      ColumnTypeEnum[name as keyof typeof ColumnTypeEnum],
    );
  }
});

// Every driver reports the affected row count under a different key.
it.each([
  ["better-sqlite3 / node-sqlite", { success: true, changes: 3 }, 3],
  ["postgresql / pglite", { success: true, rowCount: 3 }, 3],
  ["mysql2", { success: true, affectedRows: 3 }, 3],
  ["libsql / planetscale", { rowsAffected: 3 }, 3],
  ["cloudflare-d1", { meta: { changes: 3 } }, 3],
  ["bigint counts", { rowsAffected: 3n }, 3],
  ["no count reported", { success: true }, 0],
])("normalizes affected rows: %s", (_name, result, expected) => {
  expect(getAffectedRows(result)).toBe(expected);
});

it("refuses transactions on connectors without session support", async () => {
  const connector: Connector = {
    name: "test",
    dialect: "sqlite",
    capabilityOverrides: { transactions: false },
    getInstance: () => undefined,
    exec: () => ({ success: true }),
    prepare: () => {
      throw new Error("not implemented");
    },
  };
  const adapter = await prisma(createDatabase(connector)).connect();
  await expect(adapter.startTransaction()).rejects.toThrow(
    /does not support transactions/,
  );
});

describe.runIf(existsSync(clientDir("sqlite")))(
  "integrations: prisma: better-sqlite3",
  () => {
    let prismaClient: SqlitePrismaClient;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(sqliteConnector({ name: ":memory:" }));
      const { PrismaClient } = await import("./sqlite/client/client");
      prismaClient = new PrismaClient({ adapter: prisma(db) });
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL,
        score REAL,
        data BLOB,
        createdAt DATETIME NOT NULL
      )`;
    });

    testSuite(() => prismaClient);

    afterAll(async () => {
      await db.dispose();
    });
  },
);

describe.runIf(
  existsSync(clientDir("postgresql")) && process.env.POSTGRESQL_URL,
)("integrations: prisma: postgresql", () => {
  let prismaClient: PostgresPrismaClient;
  let db: Database<ReturnType<typeof pgConnector>>;

  beforeAll(async () => {
    db = createDatabase(
      pgConnector({ url: process.env.POSTGRESQL_URL as string }),
    );
    const { PrismaClient } = await import("./postgresql/client/client");
    prismaClient = new PrismaClient({ adapter: prisma(db) });
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL,
      score DOUBLE PRECISION,
      data BYTEA,
      "createdAt" TIMESTAMP(3) NOT NULL
    )`;
  });

  testSuite(() => prismaClient);

  afterAll(async () => {
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.dispose();
  });
});

function testSuite(
  client: () => SqlitePrismaClient | PostgresPrismaClient,
): void {
  it("insert", async () => {
    const res = await client().user.createManyAndReturn({
      data: { name: "John Doe", active: true, createdAt: CREATED_AT },
    });

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  it("select", async () => {
    const res = await client().user.findMany();

    expect(res.length).toBe(1);
    expect(res[0].name).toBe("John Doe");
  });

  // Booleans, dates and bytes are not natively bindable on every driver and
  // have to be normalized by the adapter in both directions.
  it("round-trips non-primitive column types", async () => {
    const created = await client().user.create({
      data: {
        name: "Jane Doe",
        active: false,
        score: 1.5,
        data: Buffer.from("db0"),
        createdAt: CREATED_AT,
      },
    });

    expect(created.active).toBe(false);
    expect(created.score).toBe(1.5);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(Buffer.from(created.data!).toString()).toBe("db0");

    const found = await client().user.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(found.active).toBe(false);
    expect(found.score).toBe(1.5);
    expect(found.createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(Buffer.from(found.data!).toString()).toBe("db0");
  });

  it("nullable columns", async () => {
    const res = await client().user.findMany({ where: { name: "John Doe" } });
    expect(res[0].score).toBe(null);
    expect(res[0].data).toBe(null);
  });

  it("empty result set", async () => {
    await expect(
      client().user.findMany({ where: { name: "nobody" } }),
    ).resolves.toEqual([]);
  });

  // Affected row counts are reported under a different key by every driver.
  it("reports affected rows", async () => {
    const updated = await client().user.updateMany({
      where: { name: "Jane Doe" },
      data: { score: 2.5 },
    });
    expect(updated.count).toBe(1);

    const deleted = await client().user.deleteMany({
      where: { name: "Jane Doe" },
    });
    expect(deleted.count).toBe(1);
  });

  it("commits transactions", async () => {
    await client().$transaction(async (tx) => {
      await tx.user.create({
        data: { name: "committed", active: true, createdAt: CREATED_AT },
      });
    });

    await expect(
      client().user.count({ where: { name: "committed" } }),
    ).resolves.toBe(1);
  });

  it("rolls transactions back", async () => {
    await expect(
      client().$transaction(async (tx) => {
        await tx.user.create({
          data: { name: "rolled-back", active: true, createdAt: CREATED_AT },
        });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    await expect(
      client().user.count({ where: { name: "rolled-back" } }),
    ).resolves.toBe(0);
  });

  it("serializes concurrent transactions", async () => {
    await Promise.all(
      ["a", "b", "c"].map((name) =>
        client().$transaction(async (tx) => {
          await tx.user.create({
            data: { name, active: true, createdAt: CREATED_AT },
          });
        }),
      ),
    );

    await expect(
      client().user.count({ where: { name: { in: ["a", "b", "c"] } } }),
    ).resolves.toBe(3);
  });
}
