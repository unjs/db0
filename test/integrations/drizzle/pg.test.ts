import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
    connector: () =>
      pgConnector({ url: process.env.POSTGRESQL_URL as string }),
    runIf: !!process.env.POSTGRESQL_URL,
  },
];

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
