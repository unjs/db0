import { describe } from "vitest";
import connector from "../../../src/connectors/neon/ws";
import { testConnector } from "../_tests";

describe.runIf(process.env.NEON_URL_WS)("connectors: neon pool (ws)", () => {
  testConnector({
    dialect: "postgresql",
    connector: connector({
      connectionString: process.env.NEON_URL_WS!,
    }),
  });
});
