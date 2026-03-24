import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Connector, type Database, createDatabase } from "../../../src";
import { kysely } from "../../../src/integrations/kysely";

import type { Kysely } from "kysely";

import pgliteConnector from "../../../src/connectors/pglite";
import pgConnector from "../../../src/connectors/postgresql";

interface UsersTable {
  id: number;
  name: string;
}

interface DB {
  users: UsersTable;
}

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

  describeFn(`integrations: kysely: ${name}`, () => {
    let ky: Kysely<DB>;
    let db: Database;

    beforeAll(async () => {
      db = createDatabase(connector());
      ky = kysely<DB>(db);
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.sql`CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)`;
    });

    it("insert", async () => {
      const res = await ky
        .insertInto("users")
        .values({ name: "John Doe" })
        .returning(["id", "name"])
        .execute();

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    it("select", async () => {
      const res = await ky.selectFrom("users").selectAll().execute();

      expect(res.length).toBe(1);
      expect(res[0].name).toBe("John Doe");
    });

    it("update", async () => {
      await ky
        .updateTable("users")
        .set({ name: "Jane Doe" })
        .where("name", "=", "John Doe")
        .execute();

      const res = await ky.selectFrom("users").selectAll().execute();
      expect(res[0].name).toBe("Jane Doe");
    });

    it("delete", async () => {
      await ky.insertInto("users").values({ name: "To Delete" }).execute();

      await ky.deleteFrom("users").where("name", "=", "To Delete").execute();

      const res = await ky.selectFrom("users").selectAll().execute();
      expect(res.every((r) => r.name !== "To Delete")).toBe(true);
    });

    it("transaction", async () => {
      await ky.transaction().execute(async (trx) => {
        await trx.insertInto("users").values({ name: "TX User" }).execute();
      });

      const res = await ky.selectFrom("users").selectAll().execute();
      expect(res.some((r) => r.name === "TX User")).toBe(true);
    });

    it("transaction rollback", async () => {
      const countBefore = (await ky.selectFrom("users").selectAll().execute())
        .length;

      await expect(
        ky.transaction().execute(async (trx) => {
          await trx
            .insertInto("users")
            .values({ name: "Rollback User" })
            .execute();
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");

      const countAfter = (await ky.selectFrom("users").selectAll().execute())
        .length;
      expect(countAfter).toBe(countBefore);
    });

    afterAll(async () => {
      await db.sql`DROP TABLE IF EXISTS users`;
      await db.dispose();
    });
  });
}
