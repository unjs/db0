import { describe } from "vitest";
import connector from "../../src/connectors/node-sqlite";
import { testConnector } from "./_tests";

describe("connectors: node-sqlite (native)", () => {
  testConnector({
    dialect: "sqlite",
    connector: connector({
      name: ":memory:",
    }),
  });
});
