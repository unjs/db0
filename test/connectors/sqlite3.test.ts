import { describe } from "vitest";
import connector from "../../src/connectors/sqlite3";
import { testConnector } from "./_tests";

describe("connectors: sqlite3", () => {
  testConnector({
    dialect: "sqlite",
    connector: connector({
      name: ":memory:",
    }),
  });
});
