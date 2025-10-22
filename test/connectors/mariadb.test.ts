import { describe } from "vitest";
import connector from "../../src/connectors/mariadb";
import { testConnector } from "./_tests";

describe.runIf(process.env.MYSQL_URL)("connectors: mariadb.test", () => {
  testConnector({
    dialect: "mariadb",
    connector: connector({
      host: "localhost",
      user: "test",
      password: "test",
      database: "db0",
    }),
  });
});
