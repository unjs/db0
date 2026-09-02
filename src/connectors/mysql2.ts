import type mysql from "mysql2/promise";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";
import {
  importLib,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

export type ConnectorOptions = mysql.ConnectionOptions & {
  /**
   * Optionally provide the [`mysql2`](https://www.npmjs.com/package/mysql2) library
   * (the `mysql2/promise` entry) to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("mysql2/promise")>;
};

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "mysql2", import: "mysql2/promise", version: "^3" },
};

const CONNECTOR_NAME = "mysql2";

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<mysql.QueryResult>;

export default function mysqlConnector(
  opts: ConnectorOptions,
): Connector<mysql.Connection> {
  const { lib, ...config } = opts;

  const getConnection = lazyInstance(async () => {
    const mysql = await importLib(
      CONNECTOR_NAME,
      "mysql2/promise",
      lib,
      () => import("mysql2/promise"),
    );
    return mysql.createConnection({ ...config });
  });

  const query: InternalQuery = (sql, params) =>
    getConnection()
      .then((c) => c.query(sql, params))
      .then((res) => res[0]);

  return {
    name: "mysql",
    dialect: "mysql",
    getInstance: () => getConnection(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      const connection = await getConnection.current;
      getConnection.reset();
      await connection?.end?.();
    },
  };
}

class StatementWrapper extends BoundableStatement<void> {
  #query: InternalQuery;
  #sql: string;

  constructor(sql: string, query: InternalQuery) {
    super();
    this.#sql = sql;
    this.#query = query;
  }

  async all(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as mysql.RowDataPacket[];
    return res;
  }

  async run(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as mysql.RowDataPacket[];
    return {
      success: true,
      ...res,
    };
  }

  async get(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as mysql.RowDataPacket[];
    return res[0];
  }
}
