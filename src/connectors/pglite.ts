import type { PGliteOptions, PGliteInterfaceExtensions, Results as PGLiteQueryResults } from "@electric-sql/pglite";
import { PGlite } from "@electric-sql/pglite";
import type { Connector } from "db0";
import { BoundableStatement } from "./_internal/statement";

export type ConnectorOptions = PGliteOptions

type InternalQuery = (sql: string, params?: unknown[]) => Promise<PGLiteQueryResults>

export default function pgliteConnector<TOptions extends ConnectorOptions>(opts?: TOptions) {
  type PGLiteInstance = PGlite & PGliteInterfaceExtensions<TOptions['extensions']>

  let _client: undefined | PGLiteInstance | Promise<PGLiteInstance>;

  function getClient() {
    return _client ||= PGlite.create(opts).then((res) => _client = res)
  }

  const query: InternalQuery = async (sql, params) =>{
    const client = await getClient();
    const normalizedSql = normalizeParams(sql);
    const result = await client.query(normalizedSql, params);
    return result;
  }

  return <Connector<PGLiteInstance>>{
    name: "pglite",
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: sql => query(sql),
    prepare: sql => new StatementWrapper(sql, query),
    close: async () => {
      const client = await _client;
      await client?.close?.();
      _client = undefined;
    }
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

  async all(...params) {
    const result = await this.#query(
      this.#sql,
      params
    );
    return result.rows;
  }

  async run(...params) {
    const result = await this.#query(
      this.#sql,
      params
    );
    return {
      success: true,
      ...result,
    };
  }

  async get(...params) {
    const result = await this.#query(
      this.#sql,
      params
    );
    return result.rows[0];
  }
}
