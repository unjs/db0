import mysql from "mysql2/promise";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = mysql.PoolOptions;

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<mysql.QueryResult>;

export default function mysqlConnector(
  opts: ConnectorOptions,
): Connector<mysql.PoolConnection> {
  let _pool: mysql.Pool | undefined;
  const getConnection = async () => {
    if (!_pool) {
      _pool = mysql.createPool({
        ...opts,
      });
    }
    const _connection : mysql.PoolConnection = await _pool.getConnection();
    return _connection;
  };

  const query: InternalQuery = async (sql, params) => {
    const connection = await getConnection();
		try {
			const result = await connection.query(sql, params);
			return result[0];
		} finally {
			connection.release();
		}
  }

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
