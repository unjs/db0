import { Pool, type PoolConfig, type QueryResult } from "pg";
import type { Connector, Primitive } from "db0";
import { normalizeParams } from "./_internal/postgresql.ts";
import { BoundableStatement } from "./_internal/statement.ts";
import type { ConnectorConnection } from "../types.ts";

export type ConnectorOptions = { url: string } | PoolConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<QueryResult>;

export default function postgresqlPoolConnector(
  opts: ConnectorOptions,
): Connector<Pool> {
  let _pool: undefined | Pool;
  const getPool = () => {
    _pool ??= new Pool("url" in opts ? { connectionString: opts.url } : opts);
    return _pool;
  };

  const acquireConnection = async (): Promise<ConnectorConnection> => {
    const client = await getPool().connect();
    return {
      dialect: "postgresql",
      exec: (sql) => client.query(normalizeParams(sql)),
      prepare: (sql) => new StatementWrapper(sql, client.query.bind(client)),
      dispose: async () => client.release(),
      [Symbol.asyncDispose]: async () => client.release(),
    };
  };

  const dispose = async () => {
    await _pool?.end?.();
    _pool = undefined;
  };

  return {
    name: "pg-pool",
    dialect: "postgresql",
    supportsPooling: true,
    getInstance: () => getPool(),
    exec: (sql) => getPool().query(normalizeParams(sql)),
    prepare: (sql) => new StatementWrapper(sql, getPool().query.bind(_pool)),
    acquireConnection,
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
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
