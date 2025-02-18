import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import sqlite3 from 'sqlite3'

import type { Connector, Statement } from '../types'

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

  return <Connector<sqlite3.Database>>{
    name: 'node-sqlite3',
    dialect: 'sqlite',
    getInstance: () => getDB(),
    exec(sql: string) {
      return new Promise((resolve, reject) => {
        getDB().exec(sql, (err: Error) => {
          if (err) {
            return reject(err)
          }
          resolve({ success: true })
        })
      })
    },
    prepare(sql: string) {
      const _stmt = getDB().prepare(sql)
      const stmt = <Statement>{
        bind(...params) {
          if (params.length > 0) {
            _stmt.bind(...params)
          }
          return stmt
        },
        all(...params) {
          return new Promise((resolve, reject) => {
            _stmt.all(...params, (err: Error, rows: unknown[]) => {
              if (err) {
                return reject(err)
              }
              resolve(rows)
            })
          })
        },
        run(...params) {
          return new Promise((resolve, reject) => {
            _stmt.run(...params, function (err: Error) {
              if (err) {
                return reject(err)
              }
              resolve({ success: true })
            })
          })
        },
        get(...params) {
          return new Promise((resolve, reject) => {
            _stmt.get(...params, (err: Error, row: unknown) => {
              if (err) {
                return reject(err)
              }
              resolve(row)
            })
          })
        },
      }
      return stmt
    },
  }
}
