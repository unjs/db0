import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type sqlite3 from "sqlite3";

import type { Connector, Primitive } from "db0";
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
   * Optionally provide the [`sqlite3`](https://www.npmjs.com/package/sqlite3) library
   * to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("sqlite3")>;
}

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "sqlite3", version: "^5 || ^6" },
};

const CONNECTOR_NAME = "sqlite3";

export default function nodeSqlite3Connector(
  opts: ConnectorOptions,
): Connector<sqlite3.Database> {
  const _activeStatements = new Set<StatementWrapper>();

  const getDB = lazyInstance(async () => {
    const lib = interopDefault(
      await importLib(
        CONNECTOR_NAME,
        "sqlite3",
        opts.lib,
        () => import("sqlite3"),
      ),
    );
    if (opts.name === ":memory:") {
      return new lib.Database(":memory:");
    }
    const filePath = resolve(
      opts.cwd || ".",
      opts.path || `.data/${opts.name || "db"}.sqlite3`,
    );
    mkdirSync(dirname(filePath), { recursive: true });
    return new lib.Database(filePath);
  });

  const query = async (sql: string) => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      db.exec(sql, (err: Error | null) => {
        if (err) {
          return reject(err);
        }
        resolve({ success: true });
      });
    });
  };

  return {
    name: "sqlite3",
    dialect: "sqlite",
    getInstance: () => getDB(),
    exec: (sql: string) => query(sql),
    prepare: (sql) => {
      const stmt = new StatementWrapper(sql, getDB());
      _activeStatements.add(stmt);
      return stmt;
    },
    dispose: async () => {
      await Promise.all(
        [..._activeStatements].map((s) =>
          s.finalize().catch((error) => {
            console.warn("[db0] [sqlite3] failed to finalize statement", error);
          }),
        ),
      );
      _activeStatements.clear();
      const db = await getDB.current;
      getDB.reset();
      if (db) {
        await new Promise<void>((resolve, reject) =>
          db.close?.((error) => (error ? reject(error) : resolve())),
        );
      }
    },
  };
}

class StatementWrapper extends BoundableStatement<Promise<sqlite3.Statement>> {
  #onError?: (err: Error | null) => void; // #162

  constructor(sql: string, db: Promise<sqlite3.Database>) {
    super(
      db.then((db) =>
        db.prepare(sql, (err) => {
          if (err && this.#onError) {
            return this.#onError(err);
          }
        }),
      ),
    );
    // Surfaced when the statement is actually used
    this._statement.catch(() => {});
  }
  async all(...params: Primitive[]) {
    const statement = await this._statement;
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      this.#onError = reject;
      statement.all(...params, (err: Error | null, rows: unknown[]) =>
        err ? reject(err) : resolve(rows),
      );
    });
    return rows;
  }
  async run(...params: Primitive[]) {
    const statement = await this._statement;
    await new Promise<void>((resolve, reject) => {
      this.#onError = reject;
      statement.run(...params, (err: Error | null) =>
        err ? reject(err) : resolve(),
      );
    });
    return { success: true };
  }
  async get(...params: Primitive[]) {
    const statement = await this._statement;
    const row = await new Promise((resolve, reject) => {
      this.#onError = reject;
      statement.get(...params, (err: Error | null, row: unknown) =>
        err ? reject(err) : resolve(row),
      );
    });
    return row;
  }

  async finalize() {
    // TODO: Can we await on finalize cb?
    (await this._statement).finalize();
  }
}
