import { createClient } from "@libsql/client";
import type { Client, InStatement, Config } from "@libsql/client";
import type { Connector, Statement } from "../types";

export type ConnectorOptions = Config;

export const makelibSqlConnector = (name: string) =>
  function libSqlConnector(opts: ConnectorOptions) {
    let _client: undefined | Client;
    function getClient() {
      if (_client) {
        return _client;
      }
      _client = createClient(opts);
      return _client;
    }

    function query(sql: InStatement) {
      const client = getClient();
      return client.execute(sql);
    }

    return <Connector>{
      name,
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
              (r) => r.rows
            );
          },
          run(...params) {
            return query({ sql: this._sql, args: params || this._params }).then(
              (r) => ({
                result: r,
                rows: r.rows,
              })
            );
          },
          get(...params) {
            // TODO: Append limit?
            return query({ sql: this._sql, args: params || this._params }).then(
              (r) => r.rows[0]
            );
          },
        };
        return stmt;
      },
    };
  };

export default makelibSqlConnector("libsql");
