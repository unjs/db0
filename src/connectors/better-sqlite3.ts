import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { Connector } from "../types";
import type { Statement as RawStatement } from 'better-sqlite3'
import { BoundableStatement } from "./_internal/statement";

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

  return <Connector<Database.Database>>{
    name: "sqlite",
    dialect: "sqlite",
    getInstance: () => getDB(),
    exec: sql => getDB().exec(sql),
    prepare: sql => new StatementWrapper(getDB().prepare(sql))
  };
}

class StatementWrapper extends BoundableStatement<RawStatement> {
  all(...params) {
    return Promise.resolve(this._rawStmt.all(...params));
  }

  run(...params) {
    const res = this._rawStmt.run(...params);
    return Promise.resolve({ success: res.changes > 0, ...res });
  }

  get(...params) {
    return Promise.resolve(this._rawStmt.get(...params));
  }
}
