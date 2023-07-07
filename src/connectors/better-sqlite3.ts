import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";

import type { Connector, Statement } from "../types";

export interface ConnectorOptions {
  cwd?: string;
  path?: string;
  name?: string;
}

export default function sqliteConnector(opts: ConnectorOptions) {
  let _db: Database.Database;
  const getDB = () => {
    if (_db) {
      return _db;
    }
    const filePath = resolve(
      opts.cwd || ".",
      opts.path || `.data/${opts.name || "db"}.sqlite3`,
    );
    mkdirSync(dirname(filePath), { recursive: true });
    _db = new Database(filePath);
    return _db;
  };

  return <Connector>{
    name: "sqlite",
    exec(sql: string) {
      return getDB().exec(sql);
    },
    prepare(sql: string) {
      const _stmt = getDB().prepare(sql);
      const stmt = <Statement>{
        bind(...params) {
          if (params.length > 0) {
            _stmt.bind(...params);
          }
          return stmt;
        },
        all(...params) {
          return Promise.resolve(_stmt.all(...params));
        },
        run(...params) {
          const res = _stmt.run(...params);
          return Promise.resolve({ success: res.changes > 0 });
        },
        get(...params) {
          return Promise.resolve(_stmt.get(...params));
        },
      };
      return stmt;
    },
  };
}
