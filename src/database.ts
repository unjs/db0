import { sqlTemplate } from "./template.ts";
import type { Connector, Database, SQLDialect } from "./types.ts";
import type { Primitive } from "./types.ts";

const SQL_SELECT_RE = /^select/i;
const SQL_RETURNING_RE = /[\s]returning[\s]/i;
const DIALECTS_WITH_RET: Set<SQLDialect> = new Set(["postgresql", "sqlite"]);

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

    getInstance() {
      return connector.getInstance();
    },

    exec: (sql: string) => {
      return Promise.resolve(connector.exec(sql));
    },

    prepare: (sql: string) => {
      return connector.prepare(sql);
    },

    sql: async (strings: TemplateStringsArray, ...values: Primitive[]) => {
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
  };
}
