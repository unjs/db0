import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { Database, Statement as RawStatement } from "bun:sqlite";
import type { Connector } from "db0";
import { BoundableStatement } from "./_internal/statement";

export interface ConnectorOptions {
  cwd?: string;
  path?: string;
  name?: string;
}

export default function bunSqliteConnector(opts: ConnectorOptions): Connector<Database> {
  let _db: Database;
  const getDB = () => {
    if (_db) {
      return _db;
    }
    if (opts.name === ":memory:") {
      _db = new Database(":memory:");
    } else {
      const filePath = resolve(
        opts.cwd || ".",
        opts.path || `.data/${opts.name || "db"}.bun.sqlite`,
      );
      mkdirSync(dirname(filePath), { recursive: true });
      _db = new Database(filePath);
    }
    return _db;
  };

  return {
    name: "sqlite",
    dialect: "sqlite",
    getInstance: () => getDB(),
    exec: sql => getDB().exec(sql),
    prepare: sql => new StatementWrapper(getDB().prepare(sql))
  };
}

class StatementWrapper extends BoundableStatement<RawStatement> {
  all(...params) {
    return Promise.resolve(this._statement.all(...params));
  }

  run(...params) {
    const res = this._statement.run(...params);
    return Promise.resolve({ success: true, ...res });
  }

  get(...params) {
    return Promise.resolve(this._statement.get(...params));
  }
}
