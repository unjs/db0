import mariadb from "mariadb";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorConfig = mariadb.ConnectionConfig;

type InternalQuery = (sql: string, params?: unknown[]) => Promise<any>;

export default function mysqlConnector(
  opts: ConnectorConfig,
): Connector<mariadb.Connection> {
  let _connection: mariadb.Connection | undefined;
  const getConnection = async () => {
    if (_connection) {
      return _connection;
    }

    _connection = await mariadb.createConnection({
      ...opts,
    });

    return _connection;
  };

  const query: InternalQuery = (sql, params) =>
    getConnection()
      .then((c) => c.query(sql, params))
      .then((res) => res[0]);

  return {
    name: "mariadb",
    dialect: "mariadb",
    getInstance: () => getConnection(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await _connection?.end?.();
      _connection = undefined;
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
    const res = await this.#query(this.#sql, params);
    return Array.isArray(res) ? res : [res];
  }

  async run(...params: Primitive[]) {
    const res = (await this.#query(this.#sql, params)) as mariadb.UpsertResult;
    return {
      success: true,
      ...res,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return Array.isArray(res) ? res[0] : res;
  }
}
