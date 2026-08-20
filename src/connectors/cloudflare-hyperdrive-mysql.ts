import type mysql from "mysql2/promise";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";
import { getHyperdrive } from "./_internal/cloudflare.ts";
import {
  importLib,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

type OmitMysqlConfig = Omit<
  mysql.ConnectionOptions,
  | "user"
  | "database"
  | "password"
  | "password1"
  | "password2"
  | "password3"
  | "port"
  | "host"
  | "uri"
  | "localAddress"
  | "socketPath"
  | "insecureAuth"
  | "passwordSha1"
  | "disableEval"
>;

export type ConnectorOptions = {
  bindingName: string;

  /**
   * Optionally provide the [`mysql2`](https://www.npmjs.com/package/mysql2) library
   * (the `mysql2/promise` entry) to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("mysql2/promise")>;
} & OmitMysqlConfig;

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "mysql2", version: "^3" },
};

const CONNECTOR_NAME = "cloudflare-hyperdrive-mysql";

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<mysql.QueryResult>;

export default function cloudflareHyperdriveMysqlConnector(
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
    const hyperdrive = await getHyperdrive(opts.bindingName);
    return mysql.createConnection({
      ...config,
      host: hyperdrive.host,
      user: hyperdrive.user,
      password: hyperdrive.password,
      database: hyperdrive.database,
      port: hyperdrive.port,
      // The following line is needed for mysql2 compatibility with Workers
      // mysql2 uses eval() to optimize result parsing for rows with > 100 columns
      // Configure mysql2 to use static parsing instead of eval() parsing with disableEval
      disableEval: true,
    });
  });

  const query: InternalQuery = (sql, params) =>
    getConnection()
      .then((c) => c.query(sql, params))
      .then((res) => res[0]);

  return {
    name: "cloudflare-hyperdrive-mysql",
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
