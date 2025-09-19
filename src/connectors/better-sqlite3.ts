import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Connector } from "db0";
import type { Statement as RawStatement } from 'better-sqlite3'
import { BoundableStatement } from "./_internal/statement";

export interface ConnectorOptions {
  cwd?: string;
  path?: string;
  name?: string;
}

export default function sqliteConnector(opts: ConnectorOptions): Connector<Database.Database> {
  let _db: Database.Database;
  const getDB = () => {
    if (_db) {
      return _db;
    }
    if (opts.name === ":memory:") {
      _db = new Database(":memory:");
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

  return {
    name: "sqlite",
    dialect: "sqlite",
    getInstance: () => getDB(),
    exec: sql => getDB().exec(sql),
    prepare: sql => new StatementWrapper(() => getDB().prepare(sql)),
    close: () => {
      if (_db) {
        _db.close();
        _db = undefined as any;
      }
    }
  };
}

class StatementWrapper extends BoundableStatement<() => RawStatement> {
  async all(...params) {
    return this._statement().all(...params)
  }

  async run(...params) {
    const res = this._statement().run(...params)
    return { success: res.changes > 0, ...res }
  }

  async get(...params) {
    return this._statement().get(...params)
  }
}
