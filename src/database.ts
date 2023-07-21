import type { Connector, Database } from "./types";
import { sqlTemplate } from "./template";

const SQL_WITH_RES_RE = /^select/i;

export function createDatabase(connector: Connector): Database {
  return <Database>{
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
