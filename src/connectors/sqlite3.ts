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
    prepare: (sql) => new StatementWrapper(sql, getDB())
  }
}

class StatementWrapper extends BoundableStatement<sqlite3.Statement> {
  #callback?: (err: Error | null, res?: unknown) => void

  constructor(sql: string, db: sqlite3.Database) {
    super(db.prepare(sql, (err, res) => {
      // Forward the error and result to the callback
      if (this.#callback && err) {
        return this.#callback(err, res);
      }
    }))
  }
  async all(...params) {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      this.#callback = (err, rows) => err ? reject(err) : resolve(rows);
      this._statement.all(...params, this.#callback);
    })
    return rows
  }
  async run(...params) {
    await new Promise<void>((resolve, reject) => {
      this.#callback = (err) => err ? reject(err) : resolve();
      this._statement.run(...params, this.#callback)
    })
    return { success: true }
  }
  async get(...params) {
    const row = await new Promise((resolve, reject) => {
      this.#callback = (err, row) => err ? reject(err) : resolve(row);
      this._statement.get(...params, this.#callback)
    })
    return row
  }
}
