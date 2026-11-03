import { getCapabilities } from "./capabilities.ts";
import { sqlTemplate } from "./template.ts";
import type { Connector, Database, SQLDialect } from "./types.ts";
import type { Primitive } from "./types.ts";

const SQL_SELECT_RE = /^select/i;
const SQL_RETURNING_RE = /[\s]returning(?:[\s(])/i;
const DIALECTS_WITH_RET: Set<SQLDialect> = new Set(["postgresql", "sqlite"]);

/**
 * Replaces the contents of string literals, quoted identifiers and comments
 * with spaces, keeping the length and the rest of the statement intact.
 *
 * The result is only ever used to look for keywords, never to execute: a word
 * inside `'...'`, `"..."`, `` `...` ``, `-- ...` or `/* ... *​/` is data, and
 * matching it there decides `all()` versus `run()` on text the caller did not
 * mean as SQL.
 */
function maskSqlData(sql: string): string {
  let masked = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"' || ch === "`") {
      masked += ch;
      i++;
      while (i < sql.length) {
        if (sql[i] === ch) {
          if (sql[i + 1] === ch) {
            masked += "  ";
            i += 2;
            continue;
          }
          masked += ch;
          i++;
          break;
        }
        masked += " ";
        i++;
      }
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        masked += " ";
        i++;
      }
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      masked += "  ";
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) {
        masked += " ";
        i++;
      }
      if (i < sql.length) {
        masked += "  ";
        i += 2;
      }
      continue;
    }
    masked += ch;
    i++;
  }
  return masked;
}

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
  const capabilities = getCapabilities(
    connector.dialect,
    connector.capabilityOverrides,
  );

  let _disposed = false;
  const checkDisposed = () => {
    if (_disposed) {
      const err = new Error(DISPOSED_ERR);
      Error.captureStackTrace?.(err, checkDisposed);
      throw err;
    }
  };

  return <Database<TConnector>>{
    get connector() {
      return connector.name;
    },

    get dialect() {
      return connector.dialect;
    },

    get capabilities() {
      return capabilities;
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
      const keywordSql = maskSqlData(sql);
      if (
        SQL_SELECT_RE.test(keywordSql) /* select */ ||
        // prettier-ignore
        (DIALECTS_WITH_RET.has(connector.dialect) && SQL_RETURNING_RE.test(keywordSql)) /* returning */
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
