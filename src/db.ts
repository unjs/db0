import type { Connector, Database } from "./types";

export function createDatabase(connector: Connector): Database {
  return <Database>{
    exec: (sql: string) => {
      return Promise.resolve(connector.exec(sql));
    },
    prepare: (sql: string) => {
      return connector.prepare(sql);
    },
  };
}
