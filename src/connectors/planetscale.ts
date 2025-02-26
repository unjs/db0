import { Client, type ExecutedQuery, type Config } from "@planetscale/database";

import type { Connector } from "db0";

import { BoundableStatement } from "./_internal/statement";

export type ConnectorOptions = Config

type InternalQuery = (sql: string, params?: unknown[]) => Promise<ExecutedQuery>;

export default function planetscaleConnector(opts: ConnectorOptions): Connector<Client> {
  let _client: undefined | Client;
  function getClient() {
    if (_client) {
      return _client;
    }
    const client = new Client(opts);
    _client = client;
    return client;
  }

  // Discussion on how @planetscale/database client works:
  // https://github.com/drizzle-team/drizzle-orm/issues/1743#issuecomment-1879479647
  const query: InternalQuery = (sql, params) => getClient().execute(sql, params);

  return {
    name: "planetscale",
    dialect: "mysql",
    getInstance: () => getClient(),
    exec: sql => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
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

  async all(...params) {
    const res = await this.#query(this.#sql, params)
    return res.rows;
  }

  async run(...params) {
    const res = await this.#query(this.#sql, params)
    return {
      success: true,
      ...res,
    }
  }

  async get(...params) {
    const res = await this.#query(this.#sql, params)
      return res.rows[0];
  }
}
