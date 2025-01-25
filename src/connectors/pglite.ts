import type { PGliteOptions, PGliteInterfaceExtensions } from "@electric-sql/pglite";
import { PGlite } from "@electric-sql/pglite";
import type { Connector, Statement } from "../types";

export type ConnectorOptions = PGliteOptions

export default function pgliteConnector<TOptions extends ConnectorOptions>(opts?: TOptions) {
  let _client: PGlite & PGliteInterfaceExtensions<TOptions['extensions']> | undefined;

  async function getClient(): Promise<PGlite & PGliteInterfaceExtensions<TOptions['extensions']>> {
    if (_client) {
      return _client;
    }
    _client = await PGlite.create(opts);
    return _client;
  }

  async function query(sql: string, params: unknown[] = undefined) {
    const client = await getClient();
    const normalizedSql = normalizeParams(sql);
    const result = await client.query(normalizedSql, params);
    return result;
  }

  return <Connector<PGlite & PGliteInterfaceExtensions<TOptions['extensions']>>>{
    name: "pglite",
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec(sql: string) {
      return query(sql);
    },
    prepare(sql: string) {
      const stmt = <Statement>{
        _sql: sql,
        _params: [],
        bind(...params: unknown[]) {
          if (params.length > 0) {
            this._params = params;
          }
          return this;
        },
        async all(...params: unknown[]) {
          const result = await query(
            this._sql,
            params.length > 0 ? params : this._params
          );
          return result.rows;
        },
        async run(...params: unknown[]) {
          const result = await query(
            this._sql,
            params.length > 0 ? params : this._params
          );
          return {
            success: true,  // Adding the success property to match the expected type
            result,
            rows: result.rows,
          };
        },
        async get(...params: unknown[]) {
          const result = await query(
            this._sql,
            params.length > 0 ? params : this._params
          );
          return result.rows[0];
        },
      };
      return stmt;
    },
  };
}

// https://www.postgresql.org/docs/9.3/sql-prepare.html
function normalizeParams(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
