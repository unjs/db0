import { describe } from "vitest";
import connector from "../../src/connectors/pg-pool.ts";
import { testConnector } from "./_tests.ts";

describe.runIf(process.env.POSTGRESQL_URL)("connectors: pg-pool.test", () => {
  testConnector({
    dialect: "postgresql",
    connector: connector({
      url: process.env.POSTGRESQL_URL!,
    }),
  });
});
