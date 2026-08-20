import type {
  PGlite,
  PGliteOptions,
  PGliteInterfaceExtensions,
  Results as PGLiteQueryResults,
} from "@electric-sql/pglite";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";
import { normalizeParams } from "./_internal/postgresql.ts";
import {
  importLib,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

export type ConnectorOptions = PGliteOptions & {
  /**
   * Optionally provide the [`@electric-sql/pglite`](https://www.npmjs.com/package/@electric-sql/pglite)
   * library to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("@electric-sql/pglite")>;
};

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "@electric-sql/pglite", version: "^0.3 || ^0.4 || ^0.5" },
};

const CONNECTOR_NAME = "pglite";

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<PGLiteQueryResults<unknown>>;

export default function pgliteConnector<TOptions extends ConnectorOptions>(
  opts?: TOptions,
): Connector<PGlite & PGliteInterfaceExtensions<TOptions["extensions"]>> {
  type PGLiteInstance = PGlite &
    PGliteInterfaceExtensions<TOptions["extensions"]>;

  const { lib, ...config } = opts || ({} as TOptions);

  const getClient = lazyInstance<PGLiteInstance>(async () => {
    const { PGlite } = await importLib(
      CONNECTOR_NAME,
      "@electric-sql/pglite",
      lib,
      () => import("@electric-sql/pglite"),
    );
    return PGlite.create(config) as Promise<PGLiteInstance>;
  });

  const query: InternalQuery = async (sql, params) => {
    const client = await getClient();
    const normalizedSql = normalizeParams(sql);
    const result = await client.query(normalizedSql, params);
    return result;
  };

  return <Connector<PGLiteInstance>>{
    name: "pglite",
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      const client = await getClient.current;
      getClient.reset();
      await client?.close?.();
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
    const result = await this.#query(this.#sql, params);
    return result.rows;
  }

  async run(...params: Primitive[]) {
    const result = await this.#query(this.#sql, params);
    return {
      success: true,
      ...result,
    };
  }

  async get(...params: Primitive[]) {
    const result = await this.#query(this.#sql, params);
    return result.rows[0];
  }
}
