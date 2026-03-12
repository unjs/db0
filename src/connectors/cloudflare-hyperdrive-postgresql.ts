import pg from "pg";

import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./_internal/statement.ts";
import { getHyperdrive } from "./_internal/cloudflare.ts";

type OmitPgConfig = Omit<
  pg.ClientConfig,
  "user" | "database" | "password" | "port" | "host" | "connectionString"
>;
export type ConnectorOptions = {
  bindingName: string;
} & OmitPgConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function cloudflareHyperdrivePostgresqlConnector(
  opts: ConnectorOptions,
): Connector<pg.Client> {
  let _client: undefined | pg.Client | Promise<pg.Client>;
  async function getClient() {
    if (_client) {
      return _client;
    }
    const hyperdrive = await getHyperdrive(opts.bindingName);
    const client = new pg.Client({
      ...opts,
      connectionString: hyperdrive.connectionString,
    });
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
    name: "cloudflare-hyperdrive-postgresql",
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
