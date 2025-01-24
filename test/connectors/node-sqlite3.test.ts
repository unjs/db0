import { describe } from "vitest";
import connector from "../../src/connectors/node-sqlite3";
import { testConnector } from "./_tests";

describe("connectors: node-sqlite3", () => {
  testConnector({
    dialect: "sqlite",
    connector: connector({
      name: ":memory:",
    }),
  });
});
