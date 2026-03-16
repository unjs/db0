import { vi, describe } from "vitest";
import { testConnector } from "./_tests";

vi.mock("@neondatabase/serverless", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const pglite = await PGlite.create();
  return {
    neon: () => {
      const queryFn = async (sql: string, params?: unknown[]) => {
        const result = await pglite.query(sql, params);
        return result.rows;
      };
      queryFn.query = queryFn;
      return queryFn;
    },
  };
});

const { default: neonConnector } = await import("../../src/connectors/neon");

describe("connectors: neon (mocked with pglite)", () => {
  testConnector({
    dialect: "postgresql",
    connector: neonConnector({
      url: "postgresql://mock@localhost/mock",
    }),
  });
});
