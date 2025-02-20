import type { Client, InStatement } from "@libsql/client";
import type { Connector, Statement } from "../../types";
import { BoundableStatement } from "../_internal/statement";

export type ConnectorOptions = {
  getClient: () => Client;
  name?: string;
};

type InternalQuery = (sql: InStatement) => Promise<any>;

export default function libSqlCoreConnector(opts: ConnectorOptions) {
  const query: InternalQuery = (sql) => opts.getClient().execute(sql);

  return <Connector<Client>>{
    name: opts.name || "libsql-core",
    dialect: "libsql",
    getInstance: async () => opts.getClient(),
    exec: sql => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
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

  async all(...params) {
    const res = await this.#query({ sql: this.#sql, args: params })
    return res.rows;
  }

  async run(...params) {
   const res = await this.#query({ sql: this.#sql, args: params })
    return {
      ...res
    }
  }

  async get(...params) {
    const res = await this.#query({ sql: this.#sql, args: params })
    return res.rows[0];
  }
}
