import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Database, createDatabase } from "../../../src";
import { prisma } from "../../../src/integrations/prisma";
import type { PrismaClient } from "./dist/client";

import sqliteConnector from "../../../src/connectors/better-sqlite3";
import pgConnector from "../../../src/connectors/postgresql";

const outputDir = resolve(import.meta.dirname, "./dist");

const prismaClientGenerated = existsSync(outputDir);

describe.runIf(prismaClientGenerated)(
  "integrations: prisma: better-sqlite3",
  () => {
    let prismaClient: PrismaClient;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(sqliteConnector({}));
      const { PrismaClient } = await import("./dist/client");
      prismaClient = new PrismaClient({ adapter: prisma(db) });
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`create table if not exists users (
      id integer primary key autoincrement,
      name text
    )`;
    });

    it("insert", async () => {
      const res = await prismaClient.user.createManyAndReturn({
        data: { name: "John Doe" },
      });

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    it("select", async () => {
      const res = await prismaClient.user.findMany();

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
    });
  },
);

describe.runIf(prismaClientGenerated && process.env.POSTGRESQL_URL)(
  "integrations: prisma: postgres",
  () => {
    let prismaClient: PrismaClient;
    let db: Database<ReturnType<typeof pgConnector>>;

    beforeAll(async () => {
      db = createDatabase(
        pgConnector({
          url: process.env.POSTGRESQL_URL as string,
        }),
      );

      const { PrismaClient } = await import("./dist/client");
      prismaClient = new PrismaClient({ adapter: prisma(db) });
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`CREATE TABLE users ("id" INTEGER PRIMARY KEY, "name" TEXT)`;
    });

    it("insert", async () => {
      const res = await prismaClient.user.createManyAndReturn({
        data: { id: 1, name: "John Doe" },
      });

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    it("select", async () => {
      const res = await prismaClient.user.findMany();

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
    });
  },
);
