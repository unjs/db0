import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import sqlite3 from 'sqlite3'

import type { Connector } from 'db0'
import { BoundableStatement } from "./_internal/statement";

export interface ConnectorOptions {
  cwd?: string
  path?: string
  name?: string
}

export default function nodeSqlite3Connector(opts: ConnectorOptions): Connector<sqlite3.Database> {
  let _db: sqlite3.Database
  const _statements = new Set<StatementWrapper>()

  const getDB = () => {
    if (_db) {
      return _db
    }
    if (opts.name === ':memory:') {
      _db = new sqlite3.Database(':memory:')
      return _db
    }
    const filePath = resolve(
      opts.cwd || '.',
      opts.path || `.data/${opts.name || 'db'}.sqlite3`,
    )
    mkdirSync(dirname(filePath), { recursive: true })
    _db = new sqlite3.Database(filePath)
    return _db
  }

  const query = (sql: string) => new Promise((resolve, reject) => {
    getDB().exec(sql, (err: Error) => {
      if (err) {
        return reject(err)
      }
      resolve({ success: true })
    })
  })

  return {
    name: 'sqlite3',
    dialect: 'sqlite',
    getInstance: () => getDB(),
    exec: (sql: string) => query(sql),
    prepare: (sql) => {
      const stmt = new StatementWrapper(sql, getDB())
      _statements.add(stmt)
      return stmt
    },
    close: () => {
      return new Promise<void>((resolve) => {
        // Finalize all prepared statements first
        for (const stmt of _statements) {
          try {
            stmt.finalize()
          } catch {
            // Ignore errors during finalization
          }
        }
        _statements.clear()

        _db?.close?.()
        _db = undefined as any;
        resolve();
      });
    }
  }
}

class StatementWrapper extends BoundableStatement<sqlite3.Statement> {
  #onError?: (err: Error | null) => void  // #162

  constructor(sql: string, db: sqlite3.Database) {
    super(db.prepare(sql, (err) => {
      if (err && this.#onError) {
        return this.#onError(err);
      }
    }))
  }
  async all(...params) {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      this.#onError = reject
      this._statement.all(...params, (err, rows) => err ? reject(err) : resolve(rows))
    })
    return rows
  }
  async run(...params) {
    await new Promise<void>((resolve, reject) => {
      this.#onError = reject
      this._statement.run(...params, (err) => err ? reject(err) : resolve())
    })
    return { success: true }
  }
  async get(...params) {
    const row = await new Promise((resolve, reject) => {
      this.#onError = reject
      this._statement.get(...params, (err, row) => err ? reject(err) : resolve(row))
    })
    return row
  }

  finalize() {
    this._statement.finalize()
  }
}
