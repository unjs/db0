import { type ClientConfig, Client, type QueryResult } from "pg";
import * as mutex from "ciorent/mutex";

import type { Connector, Primitive } from "db0";

import { normalizeParams } from "./_internal/postgresql.ts";
import { BoundableStatement } from "./_internal/statement.ts";
import type { ConnectorConnection } from "../types.ts";

export type ConnectorOptions = { url: string } | ClientConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<QueryResult>;

export default function postgresqlConnector(
  opts: ConnectorOptions,
): Connector<Client> {
  let _client: undefined | Client | Promise<Client>;
  function getClient() {
    if (_client) {
      return _client;
    }
    const client = new Client("url" in opts ? opts.url : opts);
    _client = client.connect().then(() => {
      _client = client;
      return _client;
    });
    return _client;
  }

  const connectionMutex = mutex.init();
  const acquireConnection = async (): Promise<ConnectorConnection> => {
    const releaseMutex = await mutex.acquire(connectionMutex);

    const client = await getClient();
    return {
      dialect: "postgresql",
      exec: (sql) => client.query(normalizeParams(sql)),
      prepare: (sql) => new StatementWrapper(sql, client.query.bind(client)),
      dispose: async () => releaseMutex(),
      [Symbol.asyncDispose]: async () => releaseMutex(),
    };
  };

  const buildQueryFn =
    (getClient: () => Client | Promise<Client>): InternalQuery =>
    async (...params) =>
      (await getClient()).query(...params);

  const dispose = async () => {
    (await _client)?.end?.();
    _client = undefined;
  };

  return {
    name: "postgresql",
    dialect: "postgresql",
    supportsPooling: false,
    getInstance: () => getClient(),
    exec: buildQueryFn(getClient),
    prepare: (sql) => new StatementWrapper(sql, buildQueryFn(getClient)),
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
