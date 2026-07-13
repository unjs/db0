import * as pg from "@neondatabase/serverless";
import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./statement.ts";

export type NeonClientOptions = { url?: string } | pg.ClientConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

/**
 * Resolves the connection string to connect with, called lazily on first use.
 */
export type ConnectionStringResolver = (
  opts: NeonClientOptions | undefined,
) => string | undefined | Promise<string | undefined>;

export function resolveStaticConnectionString(
  opts: NeonClientOptions | undefined,
): string | undefined {
  if (opts && "url" in opts) {
    return opts.url;
  }
  if (opts && "connectionString" in opts) {
    return opts.connectionString;
  }
}

export function createNeonConnector(
  name: string,
  opts: NeonClientOptions | undefined,
  resolveConnectionString: ConnectionStringResolver = resolveStaticConnectionString,
): Connector<pg.Client> {
  let _client: undefined | pg.Client | Promise<pg.Client>;

  async function getClient() {
    if (_client) {
      return _client;
    }

    const connectionString = await resolveConnectionString(opts);

    if (!connectionString) {
      throw new Error(
        "[db0] [neon] Missing connection string for connector. Check your environment variables.",
      );
    }

    const client =
      typeof opts === "object"
        ? new pg.Client({ ...opts, connectionString })
        : new pg.Client(connectionString);

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
    name,
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await (await _client)?.end?.();
      _client = undefined;
    },
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
