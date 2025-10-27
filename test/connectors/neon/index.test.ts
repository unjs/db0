import { describe } from "vitest";
import connector from "../../../src/connectors/neon";
import { testConnector } from "../_tests";

describe.runIf(process.env.NEON_URL_SERVERLESS)(
  "connectors: neon serverless (index)",
  () => {
    testConnector({
      dialect: "postgresql",
      connector: connector({
        connectionString: process.env.NEON_URL_SERVERLESS!,
      }),
    });
  },
);
