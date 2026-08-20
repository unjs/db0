import type * as pg from "@neondatabase/serverless";

import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./_internal/statement.ts";
import { normalizeParams } from "./_internal/postgresql.ts";
import {
  importLib,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

/**
 * Optionally provide the [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless)
 * library to avoid dynamically importing it.
 */
type WithLib = {
  lib?: LibImport<typeof import("@neondatabase/serverless")>;
};

export type ConnectorOptions = ({ url?: string } | pg.ClientConfig) & WithLib;

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "@neondatabase/serverless", version: "^1" },
};

const CONNECTOR_NAME = "neon";

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function neonConnector(
  opts?: ConnectorOptions,
): Connector<pg.Client> {
  const { lib, url, ...config } = (opts || {}) as { url?: string } & WithLib &
    pg.ClientConfig;

  const getClient = lazyInstance(async () => {
    if (url) {
      config.connectionString = url;
    }

    // `pg.ClientConfig` can identify a database without a connection string.
    if (!config.connectionString && !config.host) {
      throw new Error(
        `[db0] [${CONNECTOR_NAME}] Missing connection string. Pass \`url\` or a \`host\` to the connector.`,
      );
    }

    const pg = await importLib(
      CONNECTOR_NAME,
      "@neondatabase/serverless",
      lib,
      () => import("@neondatabase/serverless"),
    );
    const client = new pg.Client(config);
    await client.connect();
    return client;
  });

  const query: InternalQuery = async (sql, params) => {
    const client = await getClient();
    return client.query(normalizeParams(sql), params);
  };

  return {
    name: CONNECTOR_NAME,
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      const client = await getClient.current?.catch(() => undefined);
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
