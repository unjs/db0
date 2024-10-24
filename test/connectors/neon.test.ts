import { describe } from "vitest";
import connector from "../../src/connectors/neon";
import { testConnector } from "./_tests";

describe.runIf(process.env.POSTGRESQL_URL)(
  "connectors: neon.test",
  () => {
    testConnector({
      dialect: "postgresql",
      connector: connector({
        url: process.env.POSTGRESQL_URL!,
      }),
    });
  },
);
