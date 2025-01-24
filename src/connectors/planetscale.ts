import { Client, type Config } from "@planetscale/database";

import type { Connector, Statement } from "../types";

export type ConnectorOptions = Config

export default function planetscaleConnector(opts: ConnectorOptions) {
  let _client: undefined | Client;
  function getClient() {
    if (_client) {
      return _client;
    }
    const client = new Client(opts);
    _client = client;
    return client;
  }

  // Discussion on how @planetscale/database client works:
  // https://github.com/drizzle-team/drizzle-orm/issues/1743#issuecomment-1879479647
  function query(sql: string, params?: unknown[]) {
    const client = getClient();
    return client.execute(sql, params);
  }

  return <Connector<Client>>{
    name: "planetscale",
    dialect: "mysql",
    getInstance: async () => getClient(),
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
          return query(this._sql, params || this._params).then((r) => r.rows);
        },
        run(...params) {
          return query(this._sql, params || this._params).then((r) => ({
            result: r,
            rows: r.rows,
          }));
        },
        get(...params) {
          return query(this._sql, params || this._params).then(
            (r) => r.rows[0],
          );
        },
      };
      return stmt;
    },
  };
}
