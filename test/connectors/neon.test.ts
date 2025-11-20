import { describe } from "vitest";
import neonConnector from "../../src/connectors/neon";
import { testConnector } from "./_tests";

describe.runIf(process.env.NEON_URL)("connectors: Neon", () => {
  testConnector({
    dialect: "postgresql",
    connector: neonConnector({
      connectionString: process.env.NEON_URL!,
      neverGenerateConnectionString: true,
    }),
  });
});
