import { describe } from "vitest";
import neonInstantConnector from "../../src/connectors/neon-instant";
import { testConnector } from "./_tests";

describe.runIf(process.env.NEON_URL)("connectors: Neon Instant", () => {
  testConnector({
    dialect: "postgresql",
    connector: neonInstantConnector({
      connectionString: process.env.NEON_URL!,
    }),
  });
});
