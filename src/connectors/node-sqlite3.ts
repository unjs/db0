import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import sqlite3 from 'sqlite3'

import type { Connector, Statement } from '../types'
import { BoundableStatement } from "./_internal/statement";

export interface ConnectorOptions {
  cwd?: string
  path?: string
  name?: string
}

export default function nodeSqlite3Connector(opts: ConnectorOptions) {
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

  return <Connector<sqlite3.Database>>{
    name: 'node-sqlite3',
    dialect: 'sqlite',
    getInstance: () => getDB(),
    exec: (sql: string) => query(sql),
    prepare: sql => new StatementWrapper(getDB().prepare(sql)),
  }
}

class StatementWrapper extends BoundableStatement<sqlite3.Statement> {
  async all(...params) {
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      this._rawStmt.all(...params, (err, rows) => err ? reject(err) : resolve(rows))
    })
    return rows
  }
  async run(...params) {
    await new Promise<void>((resolve, reject) => {
      this._rawStmt.run(...params, (err) => err ? reject(err) : resolve())
    })
    return { success: true }
  }
  async get(...params) {
    const row = await new Promise((resolve, reject) => {
      this._rawStmt.get(...params, (err, row) => err ? reject(err) : resolve(row))
    })
    return row
  }
}
