import type { Client, InStatement } from "@libsql/client";
import type { Connector, Statement } from "../../types";

export type ConnectorOptions = {
  getClient: () => Client;
  name?: string;
};

export default function libSqlCoreConnector(opts: ConnectorOptions) {
  function query(sql: InStatement) {
    const client = opts.getClient();
    return client.execute(sql);
  }

  return <Connector<Client>>{
    name: opts.name || "libsql-core",
    dialect: "libsql",
    getInstance: async () => opts.getClient(),
    exec(sql: string) {
      return query(sql);
    },
    prepare(sql: string) {
      const stmt = <Statement>{
        _sql: sql,
        _params: [],
        bind(...params) {
          if (params.length > 0) {
            this._params = params;
          }
          return stmt;
        },
        all(...params) {
          return query({ sql: this._sql, args: params || this._params }).then(
            (r) => r.rows,
          );
        },
        run(...params) {
          return query({ sql: this._sql, args: params || this._params }).then(
            (r) => ({
              result: r,
              rows: r.rows,
            }),
          );
        },
        get(...params) {
          // TODO: Append limit?
          return query({ sql: this._sql, args: params || this._params }).then(
            (r) => r.rows[0],
          );
        },
      };
      return stmt;
    },
  };
}
