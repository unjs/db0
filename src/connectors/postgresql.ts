import type pg from "pg";

import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./_internal/statement.ts";
import { normalizeParams } from "./_internal/postgresql.ts";
import {
  importLib,
  interopDefault,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

/**
 * Optionally provide the [`pg`](https://www.npmjs.com/package/pg) library
 * to avoid dynamically importing it.
 */
type WithLib = {
  lib?: LibImport<typeof import("pg")>;
};

export type ConnectorOptions = ({ url: string } | pg.ClientConfig) & WithLib;

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "pg", version: "^8" },
};

const CONNECTOR_NAME = "postgresql";

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function postgresqlConnector(
  opts: ConnectorOptions,
): Connector<pg.Client> {
  const { lib, ...config } = opts;

  const getClient = lazyInstance(async () => {
    const pg = interopDefault(
      await importLib(CONNECTOR_NAME, "pg", lib, () => import("pg")),
    );
    const client = new pg.Client("url" in config ? config.url : config);
    await client.connect();
    return client;
  });

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
    dispose: async () => {
      const client = await getClient.current;
      getClient.reset();
      await client?.end?.();
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
