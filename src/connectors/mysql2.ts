import mysql from "mysql2/promise";
import type { Connector, Statement } from "../types";
import { BoundableStatement } from "./_internal/statement";

export type ConnectorOptions = mysql.ConnectionOptions

type InternalQuery = (sql: string, params?: unknown[]) => Promise<mysql.QueryResult>

export default function mysqlConnector(opts: ConnectorOptions) {
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

  const query: InternalQuery = (sql, params) => getConnection().then((c) => c.query(sql, params)).then((res) => res[0]);

  return <Connector<mysql.Connection>>{
    name: "mysql",
    dialect: "mysql",
    getInstance: () => getConnection(),
    exec: sql => query(sql),
    prepare: sql => new StatementWrapper(sql, query)
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
    const res =  await this.#query(this.#sql, params) as mysql.RowDataPacket[]
    return res
  }

  async run(...params) {
    const res = await this.#query(this.#sql, params) as mysql.RowDataPacket[]
    return {
      success: true,
      ...res,
    }
  }

  async get(...params) {
    const res = await this.#query(this.#sql, params) as mysql.RowDataPacket[]
    return res[0]
  }
}
