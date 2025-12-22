import pg from "pg";
import { createDatabase } from "../database.ts";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = pg.PoolConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function postgresqlPoolConnector(
  opts: ConnectorOptions,
): Connector<pg.PoolClient> {
  let _pool: undefined | pg.Pool;
  const getPool = () => {
    if (!_pool) _pool = new pg.Pool(opts);
    return _pool;
  };
  const getClient = async () => {
    let _client: pg.PoolClient | undefined;
    let _clientPromise: Promise<pg.PoolClient> | undefined;
    const _getClient = async () => {
      if (!_client) {
        if (!_clientPromise) {
          _clientPromise = getPool().connect().then(client => {
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
      _getClient().then((c) => c.query(normalizeParams(sql), params));
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

  const query: InternalQuery = async (sql, params) => {
    const pool = getPool();
    return pool.query(normalizeParams(sql), params);
  };

  return {
    name: "postgresql-pool",
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await (await _pool)?.end?.();
      _pool = undefined;
    },
  };
}

// https://www.postgresql.org/docs/9.3/sql-prepare.html
function normalizeParams(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
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
    return res.rows;
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return {
      success: true,
      ...res,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.rows[0];
  }
}
