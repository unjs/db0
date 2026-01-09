import pg from "pg";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";
import type { Connection } from "../types.ts";

export type ConnectorOptions = { url: string } | pg.PoolConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function postgresqlPoolConnector(
  opts: ConnectorOptions,
): Connector<pg.Pool> {
  let _pool: undefined | pg.Pool;
  const getPool = () => {
    _pool ??= new pg.Pool(
      "url" in opts ? { connectionString: opts.url } : opts,
    );
    return _pool;
  };

  const acquireConnection = async (): Promise<Omit<Connection, "sql">> => {
    const client = await getPool().connect();
    return {
      dialect: "postgresql",
      exec: (sql) => client.query(normalizeParams(sql)),
      prepare: (sql) => new StatementWrapper(sql, client.query),
      dispose: async () => client.release(),
      [Symbol.asyncDispose]: async () => client.release(),
    };
  };

  return {
    name: "pg-pool",
    dialect: "postgresql",
    supportsPooling: true,
    getInstance: () => getPool(),
    exec: (sql) => getPool().query(normalizeParams(sql)),
    prepare: (sql) => new StatementWrapper(sql, getPool().query.bind(_pool)),
    acquireConnection,
    dispose: async () => {
      await _pool?.end?.();
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
  readonly #query: InternalQuery;
  readonly #sql: string;

  constructor(sql: string, query: InternalQuery) {
    super();
    this.#sql = normalizeParams(sql);
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
