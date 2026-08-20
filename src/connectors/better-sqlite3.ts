import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type BetterSqlite3 from "better-sqlite3";
import type { Connector, Primitive } from "db0";
import type { Statement as RawStatement } from "better-sqlite3";
import { BoundableStatement } from "./_internal/statement.ts";
import {
  importLib,
  interopDefault,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

export interface ConnectorOptions {
  cwd?: string;
  path?: string;
  name?: string;

  /**
   * Optionally provide the [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3)
   * library to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("better-sqlite3")>;
}

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "better-sqlite3", version: "^11 || ^12 || ^13" },
};

const CONNECTOR_NAME = "better-sqlite3";

export default function sqliteConnector(
  opts: ConnectorOptions,
): Connector<BetterSqlite3.Database> {
  const getDB = lazyInstance(async () => {
    const Database = interopDefault(
      await importLib(
        CONNECTOR_NAME,
        "better-sqlite3",
        opts.lib,
        () => import("better-sqlite3"),
      ),
    );
    if (opts.name === ":memory:") {
      return new Database(":memory:");
    }
    const filePath = resolve(
      opts.cwd || ".",
      opts.path || `.data/${opts.name || "db"}.sqlite3`,
    );
    mkdirSync(dirname(filePath), { recursive: true });
    return new Database(filePath);
  });

  return {
    name: "sqlite",
    dialect: "sqlite",
    getInstance: () => getDB(),
    exec: async (sql) => (await getDB()).exec(sql),
    prepare: (sql) =>
      new StatementWrapper(async () => (await getDB()).prepare(sql)),
    dispose: async () => {
      const db = await getDB.current;
      getDB.reset();
      db?.close?.();
    },
  };
}

class StatementWrapper extends BoundableStatement<() => Promise<RawStatement>> {
  async all(...params: Primitive[]) {
    return (await this._statement()).all(...params);
  }

  async run(...params: Primitive[]) {
    const res = (await this._statement()).run(...params);
    return { success: res.changes > 0, ...res };
  }

  async get(...params: Primitive[]) {
    return (await this._statement()).get(...params);
  }
}
