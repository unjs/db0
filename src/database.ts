import { sqlTemplate } from "./template";
import type { Connector, Database } from "./types";

const SQL_WITH_RES_RE = /^select/i;

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
  return <Database<TConnector>>{
    get dialect() {
      return connector.dialect;
    },

    exec: (sql: string) => {
      return Promise.resolve(connector.exec(sql));
    },

    prepare: (sql: string) => {
      return connector.prepare(sql);
    },

    sql: async (strings, ...values) => {
      const [sql, params] = sqlTemplate(strings, ...values);
      if (SQL_WITH_RES_RE.test(sql)) {
        const rows = await connector.prepare(sql).all(...params);
        return {
          rows,
        };
      } else {
        const res = await connector.prepare(sql).run(...params);
        return res;
      }
    },
  };
}
