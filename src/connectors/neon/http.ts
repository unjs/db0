import {
  Client as NeonClient,
  type QueryResult,
  type WebSocketConstructor,
} from "@neondatabase/serverless";
import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "../_internal/statement.ts";

export type ConnectorOptions = {
  connectionString: string;
  pooler?: boolean;
  webSocketConstructor?: WebSocketConstructor;
};

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<QueryResult>;

export default function postgresqlConnector(
  connectionString?: ConnectorOptions,
  webSocketConstructor?: WebSocketConstructor,
): Connector<NeonClient> {
  let _client: undefined | NeonClient | Promise<NeonClient>;
  function getClient() {
    if (_client) {
      return _client;
    }

    const client = new NeonClient(connectionString);
    _client = client.connect().then(() => {
      /**
       * @description Allow to override the WebSocket constructor or provide one when platform does not support it.
       * @see https://github.com/neondatabase/serverless?tab=readme-ov-file#pool-and-client
       */
      if (webSocketConstructor) {
        client.neonConfig.webSocketConstructor = webSocketConstructor;
      }

      _client = client;
      return _client;
    });

    return _client;
  }

  const query: InternalQuery = async (sql, params) => {
    const client = getClient();

    return (await client).query(normalizeParams(sql), params);
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

// // https://www.postgresql.org/docs/9.3/sql-prepare.html
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
