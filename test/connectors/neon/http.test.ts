import { describe } from "vitest";
import { testConnector } from "../_tests";
import neonClientConnector from "../../../src/connectors/neon/http";

describe.runIf(process.env.NEON_URL_HTTP)("connectors: neon.test", () => {
  testConnector({
    dialect: "postgresql",
    connector: neonClientConnector({
      connectionString: process.env.NEON_URL_HTTP!,
    }),
  });
});
