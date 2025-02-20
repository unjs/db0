import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { Connector, Statement, Primitive } from "../types";

export interface ConnectorOptions {
  cwd?: string
  path?: string
  name?: string
}

export default function nodeSqlite3Connector(opts: ConnectorOptions) {
  let _db: DatabaseSync | undefined

  const getDB = () => {
    if (_db) {
      return _db
    }
    if (opts.name === ':memory:') {
      _db = new DatabaseSync(':memory:')
      return _db
    }
    const filePath = resolve(
      opts.cwd || '.',
      opts.path || `.data/${opts.name || 'db'}.sqlite3`,
    )
    mkdirSync(dirname(filePath), { recursive: true })
    _db = new DatabaseSync(filePath)
    return _db
  }

  return <Connector<DatabaseSync>>{
    name: 'node-sqlite',
    dialect: 'sqlite',
    getInstance: () => getDB(),
    exec(sql: string) {
      getDB().exec(sql)
      return { success: true }
    },
    prepare(sql: string) {
      // TODO: investgate if it is really a Node.js limit or types issue
      type SupportedValueTypes = Array<Exclude<Primitive, boolean>>

      const _stmt = getDB().prepare(sql)

      let bindParams: SupportedValueTypes | undefined

      const stmt = <Statement>{
        bind(...params) {
          bindParams = params as SupportedValueTypes
        },
        all(...callParams) {
          const params = callParams.length > 0 ? callParams : (bindParams || [])
          return _stmt.all(...params as SupportedValueTypes) as any
        },
        run(...callParams) {
          const params = callParams.length > 0 ? callParams : (bindParams || [])
          return _stmt.run(...params as SupportedValueTypes) as any
        },
        get(...callParams) {
          const params = callParams.length > 0 ? callParams : (bindParams || [])
          return _stmt.get(...params as SupportedValueTypes) as any
        },
      }
      return stmt
    },
  }
}
