import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction, HTTPTransactionOptions } from "@neondatabase/serverless";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "./_internal/statement.ts";

export interface ConnectorOptions
  extends HTTPTransactionOptions<undefined, undefined> {
  /**
   * The URL of the Neon Serverless Postgres instance.
   *
   * @required
   */
  url: string;
}

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<unknown[]>;

export default function neonConnector(
  opts: ConnectorOptions,
): Connector<NeonQueryFunction<undefined, undefined>> {
  let _connection: NeonQueryFunction<undefined, undefined>;

  function getConnection() {
    if (_connection) {
      return _connection;
    }
    const { url, ...transactionOptions } = opts;
    _connection = neon(url, transactionOptions);
    return _connection;
  }

  const query: InternalQuery = async (sql, params) => {
    const connection = getConnection();
    return connection(normalizeParams(sql), params);
  };

  return {
    name: "neon",
    dialect: "postgresql",
    getInstance: () => getConnection(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
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
    return this.#query(this.#sql, params);
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
    return res[0];
  }
}
