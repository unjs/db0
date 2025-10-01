import { sqlTemplate } from "./template.ts";
import type { Connector, Database, SQLDialect } from "./types.ts";
import type { Primitive } from "./types.ts";

const SQL_SELECT_RE = /^select/i;
const SQL_RETURNING_RE = /[\s]returning[\s]/i;
const DIALECTS_WITH_RET: Set<SQLDialect> = new Set(["postgresql", "sqlite"]);

const DISPOSED_ERR =
  "This database instance has been disposed and cannot be used.";

/**
 * Creates and returns a database interface using the specified connector.
 * This interface allows you to execute raw SQL queries, prepare SQL statements,
 * and execute SQL queries with parameters using tagged template literals.
 *
 * @param {Connector} connector - The database connector used to execute and prepare SQL statements. See {@link Connector}.
 * @returns {Database} The database interface that allows SQL operations. See {@link Database}.
 */
export function createDatabase<TConnector extends Connector = Connector>(
  connector: TConnector,
): Database<TConnector> {
  let _disposed = false;
  const checkDisposed = () => {
    if (_disposed) {
      const err = new Error(DISPOSED_ERR);
      Error.captureStackTrace?.(err, checkDisposed);
      throw err;
    }
  };

  return <Database<TConnector>>{
    get dialect() {
      return connector.dialect;
    },

    get disposed() {
      return _disposed;
    },

    getInstance() {
      checkDisposed();
      return connector.getInstance();
    },

    exec: (sql: string) => {
      checkDisposed();
      return Promise.resolve(connector.exec(sql));
    },

    prepare: (sql: string) => {
      checkDisposed();
      return connector.prepare(sql);
    },

    sql: async (strings: TemplateStringsArray, ...values: Primitive[]) => {
      checkDisposed();
      const [sql, params] = sqlTemplate(strings, ...values);
      if (
        SQL_SELECT_RE.test(sql) /* select */ ||
        // prettier-ignore
        (DIALECTS_WITH_RET.has(connector.dialect) && SQL_RETURNING_RE.test(sql)) /* returning */
      ) {
        const rows = await connector.prepare(sql).all(...params);
        return {
          rows,
          success: true,
        };
      } else {
        const res = await connector.prepare(sql).run(...params);
        return res;
      }
    },

    dispose: () => {
      _disposed = true;
      try {
        return Promise.resolve(connector.dispose?.());
      } catch (error_) {
        return Promise.reject(error_);
      }
    },

    [Symbol.asyncDispose]() {
      return this.dispose();
    },
  };
}
