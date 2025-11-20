import * as pg from "@neondatabase/serverless";
import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./_internal/statement.ts";
import { instantNeon, type InstantNeonParams } from "get-db/sdk";

export type ConnectorOptions = ({ url?: string } | pg.ClientConfig) &
  InstantNeonParams & { neverGenerateConnectionString?: boolean };

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function neonConnector(
  opts?: ConnectorOptions,
): Connector<pg.Client> {
  let _client: undefined | pg.Client | Promise<pg.Client>;

  async function getConnectionString() {
    if (opts && "url" in opts) {
      return opts.url;
    } else if (opts && "connectionString" in opts) {
      return opts.connectionString;
    } else if (
      process.env.NODE_ENV !== "production" &&
      !(opts || {}).neverGenerateConnectionString
    ) {
      const { poolerUrl } = await instantNeon({ referrer: "db0/neon-driver" });

      return poolerUrl;
    }

    throw new Error(
      "[db0]:: Missing connection string for connector. Check your environment variables.",
    );
  }

  async function getClient() {
    if (_client) {
      return _client;
    }

    const connectionString = await getConnectionString();

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
    name: "neon",
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
