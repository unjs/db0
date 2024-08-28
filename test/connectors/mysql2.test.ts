import { describe } from "vitest";
import connector from "../../src/connectors/mysql2";
import { testConnector } from "./_tests";

describe.runIf(process.env.POSTGRESQL_URL)(
  "connectors: mysql2.test",
  () => {
    testConnector({
      connector: connector({
        host: "localhost",
        user: "root",
        password: "root",
        database: "db0",
      }),
    });
  },
);