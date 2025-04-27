import mysql from "mysql2/promise";
import type { Connector } from "db0";
import { BoundableStatement } from "./_internal/statement";
import { getHyperdrive } from "./_internal/hyperdrive";

type OmitMysqlConfig = Omit<mysql.ConnectionOptions, 'user' | 'database' | 'password' | 'password1' | 'password2' | 'password3' | 'port' | 'host' | 'uri' | 'localAddress' | 'socketPath' | 'insecureAuth' | 'passwordSha1' | 'disableEval'>;
export type ConnectorOptions = {
  bindingName?: string;
} & OmitMysqlConfig;

type InternalQuery = (sql: string, params?: unknown[]) => Promise<mysql.QueryResult>

export default function cloudflareHyperdriveMysqlConnector(opts: ConnectorOptions): Connector<mysql.Connection> {
  let _connection: mysql.Connection | undefined;
  const getConnection = async () => {
    if (_connection) {
      return _connection;
    }

    const hyperdrive = await getHyperdrive(opts.bindingName);
    _connection = await mysql.createConnection({
      ...opts,
      host: hyperdrive.host,
      user: hyperdrive.user,
      password: hyperdrive.password,
      database: hyperdrive.database,
      port: hyperdrive.port,

      // The following line is needed for mysql2 compatibility with Workers
      // mysql2 uses eval() to optimize result parsing for rows with > 100 columns
      // Configure mysql2 to use static parsing instead of eval() parsing with disableEval
      disableEval: true,
    })

    return _connection;
  };

  const query: InternalQuery = (sql, params) => getConnection().then((c) => c.query(sql, params)).then((res) => res[0]);

  return {
    name: "cloudflare-hyperdrive-mysql",
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
    const res = await this.#query(this.#sql, params) as mysql.RowDataPacket[];
    return res
  }

  async run(...params) {
    const res = await this.#query(this.#sql, params) as mysql.RowDataPacket[];
    return {
      success: true,
      ...res,
    }
  }

  async get(...params) {
    const res = await this.#query(this.#sql, params) as mysql.RowDataPacket[];
    return res[0]
  }
}
