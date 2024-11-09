import { describe } from "vitest";
import connector from "../../src/connectors/mssql";
import { testConnector } from "./_tests";

describe.runIf(
  process.env.MSSQL_HOST
  && process.env.MSSQL_DB_NAME
  && process.env.MSSQL_USERNAME
  && process.env.MSSQL_PASSWORD
)(
  "connectors: mssql.test",
  () => {
    testConnector({
      dialect: "mssql",
      connector: connector({
        server: process.env.MSSQL_HOST!,
        authentication: {
          type: 'default',
          options: {
            userName: process.env.MSSQL_USERNAME!,
            password: process.env.MSSQL_PASSWORD!,
          },
        },
        options: {
          database: process.env.MSSQL_DB_NAME!,
          port: Number.parseInt(process.env.MSSQL_PORT || '1433', 10),
          trustServerCertificate: true,
          encrypt: false,
        },
      }),
    });
  },
);
