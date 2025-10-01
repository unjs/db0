import type { Client, InStatement } from "@libsql/client";
import type { Connector, Primitive } from "db0";
import { BoundableStatement } from "../_internal/statement.ts";

export type ConnectorOptions = {
  getClient: () => Client;
  name?: string;
};

type InternalQuery = (sql: InStatement) => Promise<any>;

export default function libSqlCoreConnector(
  opts: ConnectorOptions,
): Connector<Client> {
  const query: InternalQuery = (sql) => opts.getClient().execute(sql);

  return {
    name: opts.name || "libsql-core",
    dialect: "libsql",
    getInstance: async () => opts.getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: () => opts.getClient()?.close?.(),
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
    const res = await this.#query({
      sql: this.#sql,
      args: params as Exclude<Primitive, undefined>[],
    });
    return res.rows;
  }

  async run(...params: Primitive[]) {
    const res = await this.#query({
      sql: this.#sql,
      args: params as Exclude<Primitive, undefined>[],
    });
    return {
      ...res,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query({
      sql: this.#sql,
      args: params as Exclude<Primitive, undefined>[],
    });
    return res.rows[0];
  }
}
