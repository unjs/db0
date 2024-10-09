import { describe } from "vitest";
import connector from "../../src/connectors/mysql2";
import { testConnector } from "./_tests";

describe.runIf(process.env.MYSQL_URL)(
  "connectors: mysql2.test",
  () => {
    testConnector({
      dialect: "mysql",
      connector: connector({
        host: "localhost",
        user: "root",
        password: "root",
        database: "db0",
      }),
    });
  },
);
