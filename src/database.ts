import { sqlTemplate } from "./template.ts";
import type {
  Connection,
  Connector,
  Database,
  DefaultSQLResult,
  SQLDialect,
} from "./types.ts";
import type { Primitive } from "./types.ts";

const SQL_SELECT_RE = /^select/i;
const SQL_RETURNING_RE = /\sreturning\s/i;
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

  const createExecutor =
    (connector: Omit<Connection, "sql" | typeof Symbol.asyncDispose>) =>
    async <T = DefaultSQLResult>(
      strings: TemplateStringsArray,
      ...values: Primitive[]
    ): Promise<T> => {
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
        } as never;
      } else {
        const res = await connector.prepare(sql).run(...params);
        return res as never;
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

    async acquireConnection(fn) {
      const connection = await connector.acquireConnection();
      await fn({ ...connection, sql: createExecutor(connection) });
      await connection.dispose?.();
    },

    exec: (sql: string) => {
      checkDisposed();
      return Promise.resolve(connector.exec(sql));
    },

    prepare: (sql: string) => {
      checkDisposed();
      return connector.prepare(sql);
    },

    sql: createExecutor(connector),

    dispose: () => {
      if (_disposed) {
        return Promise.resolve();
      }
      _disposed = true;
      try {
        return Promise.resolve(connector.dispose?.());
      } catch (error) {
        return Promise.reject(error);
      }
    },

    [Symbol.asyncDispose]() {
      return this.dispose();
    },
  };
}
