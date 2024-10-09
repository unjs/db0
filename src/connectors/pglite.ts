import { PGlite, type Extensions } from "@electric-sql/pglite";
import type { Connector, Statement } from "../types";

// Since Filesystem is not exported, we will type it as `any` for now
export type ConnectorOptions = {
  dataDir?: string;
  debug?: 1 | 2 | 3 | 4 | 5;
  relaxedDurability?: boolean;
  fs?: any;  // Change to any or remove if not needed
  loadDataDir?: Blob | File;
  extensions?: Extensions;
  username?: string;
  database?: string;
  initialMemory?: number;
};

export default function pgliteConnector(opts: ConnectorOptions = {}) {
  let _client: PGlite | undefined;

  function getClient(): PGlite {
    if (_client) {
      return _client;
    }
    _client = new PGlite(opts);
    return _client;
  }

  async function query(sql: string, params: unknown[] = []) {
    const client = await getClient();
    const normalizedSql = normalizeParams(sql);
    const result = await client.query(normalizedSql, params);
    return result;
  }

  return <Connector>{
    name: "pglite",
    dialect: "postgresql",
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
