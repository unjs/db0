import { describe } from "vitest";
import connector from "../../src/connectors/mariadb";
import { testConnector } from "./_tests";

describe.runIf(process.env.MARIADB_URL)("connectors: mariadb.test", () => {
  testConnector({
    dialect: "mariadb",
    connector: connector({
      host: "localhost",
      port: 3307,
      user: "test",
      password: "test",
      database: "db0",
    }),
  });
});
