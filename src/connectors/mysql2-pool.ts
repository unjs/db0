import mysql from "mysql2/promise";
import { createDatabase } from "../database.ts";
import type { Connector, Database, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = mysql.PoolOptions;
type Pool = mysql.Pool & {
  getClient?: () => Promise<Database<Connector<mysql.PoolConnection>>>;
};

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<mysql.QueryResult>;

export default function postgresqlPoolConnector(
  opts: ConnectorOptions,
): Connector<Pool> {
  let _pool: Pool | undefined;
  const getPool = () => {
    if (!_pool) _pool = mysql.createPool(opts);
    _pool.getClient = getClient;
    return _pool;
  };
  const getClient = async () => {
    let _client: mysql.PoolConnection | undefined;
    let _clientPromise: Promise<mysql.PoolConnection> | undefined;
    const _getClient = async () => {
      if (!_client) {
        if (!_clientPromise) {
          _clientPromise = getPool()
            .getConnection()
            .then((client) => {
              _client = client;
              _clientPromise = undefined;
              return client;
            });
        }
        return _clientPromise;
      }
      return _client;
    };
    const _query: InternalQuery = (sql, params) =>
      _getClient()
        .then((c) => c.query(sql, params))
        .then((res) => res[0]);
    return createDatabase({
      name: "postgresql-pool-client",
      dialect: "postgresql",
      getInstance: () => _getClient(),
      exec: (sql) => _query(sql),
      prepare: (sql) => new StatementWrapper(sql, _query),
      dispose: async () => {
        _client?.release?.();
        _client = undefined;
      },
    });
  };

  const query: InternalQuery = (sql, params) =>
    getClient()
      .then((c) => c.getInstance())
      .then((c) => c.query(sql, params))
      .then((res) => res[0]);

  return {
    name: "postgresql-pool",
    dialect: "postgresql",
    getInstance: () => getPool(),
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
