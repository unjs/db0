import mysql from "mysql2/promise";

import type { Connector, Statement } from "../types";

export default function mysqlConnector(opts: mysql.ConnectionOptions) {
  let _connection: mysql.Connection | undefined;
  const getConnection = async () => {
    if (_connection) {
      return _connection;
    }

    _connection = await mysql.createConnection({
      ...opts,
    })

    return _connection;
  };

  return <Connector<mysql.Connection>>{
    name: "mysql",
    dialect: "mysql",
    getInstance: async () => getConnection(),
    exec(sql: string) {
      return getConnection().then((c) => c.query(sql).then((res) => res[0]));
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
          return getConnection().then((c) => c.query(this._sql, params || this._params).then((res) => res[0]));
        },
        run(...params) {
          return getConnection().then((c) => c.query(this._sql, params || this._params).then((res) => res[0]));
        },
        get(...params) {
          return getConnection().then((c) => c.query(this._sql, params || this._params).then((res) => res[0][0]));
        },
      };
      return stmt;
    },
  };
}
