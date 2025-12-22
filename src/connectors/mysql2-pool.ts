import mysql from "mysql2/promise";
import { createDatabase } from "../database.ts";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = mysql.PoolOptions;

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<mysql.QueryResult>;

export default function mysqlPoolConnector(
  opts: ConnectorOptions,
): Connector<mysql.PoolConnection> {
  let _pool: mysql.Pool | undefined;
  const getPool = () => {
    if (!_pool) {
      _pool = mysql.createPool({
        ...opts,
      });
    }
    return _pool;
  };
  const getConnection = async () => {
    let _connection: mysql.PoolConnection | undefined;
    let _connectionPromise: Promise<mysql.PoolConnection> | undefined;
    const _getConnection = async () => {
      if (!_connection) {
        if (!_connectionPromise) {
          _connectionPromise = getPool().getConnection().then(connection => {
            _connection = connection;
            _connectionPromise = undefined;
            return connection;
          });
        }
        return _connectionPromise;
      }
      return _connection;
    };
    const _query: InternalQuery = (sql, params) =>
      _getConnection()
        .then((c) => c.query(sql, params))
        .then((res) => res[0]);
    return createDatabase({
      name: "mysql-pool-connection",
      dialect: "mysql",
      getInstance: () => _getConnection(),
      exec: (sql) => _query(sql),
      prepare: (sql) => new StatementWrapper(sql, _query),
      dispose: async () => {
        _connection?.release?.();
        _connection = undefined;
      },
    });
  };

  const query: InternalQuery = async (sql, params) => {
    const pool = getPool();
    try {
      const result = await pool.query(sql, params);
      return result[0];
    } finally {
    }
  };

  return {
    name: "mysql-pool",
    dialect: "mysql",
    getInstance: () => getConnection(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await _pool?.end?.();
      _pool = undefined;
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
