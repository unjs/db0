import {
  neon,
  type FullQueryResults,
  type NeonQueryFunction,
} from "@neondatabase/serverless";
import type { Connector, Primitive, Statement } from "db0";

import { BoundableStatement } from "../_internal/statement.ts";

export type ConnectorOptions = {
  connectionString: string;
};

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<FullQueryResults<false>>;

export default function neonServerlessConnector(
  opts: ConnectorOptions,
): Connector<NeonQueryFunction<false, true>> {
  let _client: undefined | NeonQueryFunction<false, true>;

  function getClient() {
    if (_client) {
      return _client;
    }

    _client = neon(opts.connectionString, { fullResults: true });

    return _client;
  }

  const query: InternalQuery = async (sql, params) => {
    const client = getClient();

    return client.query(normalizeParams(sql), params);
  };

  return {
    name: "neon",
    dialect: "postgresql",
    getInstance: (): NeonQueryFunction<false, true> => getClient(),
    exec: (sql: string) => query(sql),
    prepare: (sql: string): Statement => new StatementWrapper(sql, query),
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
