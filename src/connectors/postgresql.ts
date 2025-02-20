import pg from "pg";

import type { Connector, Statement, Primitive } from "../types";

import { BoundableStatement } from "./_internal/statement";

export type ConnectorOptions = { url: string } | pg.ClientConfig;

type InternalQuery = (sql: string, params?: Primitive[]) => Promise<pg.QueryResult>;

export default function postgresqlConnector(opts: ConnectorOptions) {
  let _client: undefined | pg.Client | Promise<pg.Client>;
  function getClient() {
    if (_client) {
      return _client;
    }
    const client = new pg.Client("url" in opts ? opts.url : opts);
    _client = client.connect().then(() => {
      _client = client;
      return _client;
    });
    return _client;
  }

  const query: InternalQuery = async (sql, params) => {
    const client = await getClient();
    return client.query(normalizeParams(sql), params);
  }

  return <Connector<pg.Client>>{
    name: "postgresql",
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: sql => query(sql),
    prepare: sql => new StatementWrapper(sql, query)
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

  async all(...params) {
    const res = await this.#query(this.#sql, params);
    return res.rows;
  }

  async run(...params) {
    const res = await this.#query(this.#sql, params)
    return {
      success: true,
      ...res,
    };
  }

  async get(...params) {
    const res = await this.#query(this.#sql, params)
    return res.rows[0];
  }
}
