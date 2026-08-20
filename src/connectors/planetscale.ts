import type { Client, ExecutedQuery, Config } from "@planetscale/database";

import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./_internal/statement.ts";
import {
  importLib,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

export type ConnectorOptions = Config & {
  /**
   * Optionally provide the [`@planetscale/database`](https://www.npmjs.com/package/@planetscale/database)
   * library to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("@planetscale/database")>;
};

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "@planetscale/database", version: "^1" },
};

const CONNECTOR_NAME = "planetscale";

type InternalQuery = (
  sql: string,
  params?: unknown[],
) => Promise<ExecutedQuery>;

export default function planetscaleConnector(
  opts: ConnectorOptions,
): Connector<Client> {
  const { lib, ...config } = opts;

  const getClient = lazyInstance(async () => {
    const { Client } = await importLib(
      CONNECTOR_NAME,
      "@planetscale/database",
      lib,
      () => import("@planetscale/database"),
    );
    return new Client(config);
  });

  // Discussion on how @planetscale/database client works:
  // https://github.com/drizzle-team/drizzle-orm/issues/1743#issuecomment-1879479647
  const query: InternalQuery = async (sql, params) =>
    (await getClient()).execute(sql, params);

  return {
    name: "planetscale",
    dialect: "mysql",
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: () => {
      getClient.reset();
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
