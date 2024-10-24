import { neon, HTTPTransactionOptions, NeonQueryFunction } from '@neondatabase/serverless';

import type { Connector, Statement } from "../types";

export interface ConnectorOptions extends HTTPTransactionOptions<undefined, undefined> {
  /**
   * The URL of the Neon Serverless Postgres instance.
   *
   * @required
   */
  url: string;
}

export default function neonConnector(opts: ConnectorOptions) {
  let _connection: NeonQueryFunction<undefined, undefined>;
  const getConnection = async () => {
    if (_connection) {
      return _connection;
    }

    const { url, ...transactionOptions } = opts;

    _connection = neon(url, {
      ...transactionOptions,
    })

    return _connection;
  };

  return <Connector>{
    name: "neon",
    dialect: "postgresql",
    exec(sql: string) {
      return getConnection().then((c) => c(sql));
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
          return getConnection().then((c) => c(this._sql, params || this._params));
        },
        run(...params) {
          return getConnection().then((c) => c(this._sql, params || this._params));
        },
        get(...params) {
          return getConnection().then((c) => c(this._sql, params || this._params)).then((res) => res[0]);
        },
      };
      return stmt;
    },
  };
}
