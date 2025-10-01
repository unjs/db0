import pg from "pg";

import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = { url: string } | pg.ClientConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function postgresqlConnector(
  opts: ConnectorOptions,
): Connector<pg.Client> {
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
  };

  return {
    name: "postgresql",
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
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
