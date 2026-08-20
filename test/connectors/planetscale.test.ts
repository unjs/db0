import { describe } from "vitest";
import connector from "../../src/connectors/planetscale";
import { testConnector } from "./_tests";

describe.runIf(
  process.env.PLANETSCALE_HOST &&
    process.env.PLANETSCALE_USERNAME &&
    process.env.PLANETSCALE_PASSWORD,
)("connectors: planetscale.test", () => {
  testConnector({
    dialect: "mysql",
    capabilities: { supportsTransactions: false },
    connector: connector({
      host: process.env.PLANETSCALE_HOST!,
      username: process.env.PLANETSCALE_USERNAME!,
      password: process.env.PLANETSCALE_PASSWORD!,
    }),
  });
});
