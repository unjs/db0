import type * as pg from "@neondatabase/serverless";
import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./statement.ts";
import { lazyInstance } from "./utils.ts";

export type NeonLib = typeof import("@neondatabase/serverless");

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
  const { url, connectionString } = (opts || {}) as {
    url?: string;
    connectionString?: string;
  };
  return url || connectionString;
}

function toClientConfig(opts: NeonClientOptions | undefined): pg.ClientConfig {
  const { url: _url, ...config } = (opts || {}) as {
    url?: string;
  } & pg.ClientConfig;
  return config;
}

export function createNeonConnector(
  name: string,
  opts: NeonClientOptions | undefined,
  importNeon: () => Promise<NeonLib>,
  resolveConnectionString: ConnectionStringResolver = resolveStaticConnectionString,
): Connector<pg.Client> {
  const getClient = lazyInstance(async () => {
    const config = toClientConfig(opts);
    const connectionString = await resolveConnectionString(opts);

    if (connectionString) {
      config.connectionString = connectionString;
    }

    // `pg.ClientConfig` can identify a database without a connection string.
    if (!config.connectionString && !config.host) {
      throw new Error(
        `[db0] [${name}] Missing connection string. Pass \`url\` or a \`host\` to the connector.`,
      );
    }

    const pg = await importNeon();
    const client = new pg.Client(config);
    await client.connect();
    return client;
  });

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
      const client = await getClient.current?.catch(() => undefined);
      getClient.reset();
      await client?.end?.();
    },
  };
}

/**
 * Rewrites `?` placeholders into postgres' `$n` form, leaving `?` occurrences
 * that are not placeholders alone: those inside string literals or quoted
 * identifiers, inside comments, and the jsonb operators `?|`, `?&` and `??`.
 *
 * https://www.postgresql.org/docs/9.3/sql-prepare.html
 */
export function normalizeParams(sql: string): string {
  let result = "";
  let index = 0;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    // Quoted string ('...', including E'..' bodies) or identifier ("...").
    if (char === "'" || char === '"') {
      const end = sql.indexOf(char, i + 1);
      if (end === -1) {
        result += sql.slice(i);
        break;
      }
      result += sql.slice(i, end + 1);
      i = end;
      continue;
    }

    if (char === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      result += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }

    if (char === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      result += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }

    if (char === "?") {
      const next = sql[i + 1];
      // jsonb operators, not placeholders.
      if (next === "|" || next === "&" || next === "?") {
        result += char + next;
        i++;
        continue;
      }
      result += `$${++index}`;
      continue;
    }

    result += char;
  }

  return result;
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
