import type { Primitive, SQLDialect } from "../../types.ts";
import type { SqlQuery, ColumnType } from "@prisma/driver-adapter-utils";
import { ColumnTypeEnum } from "@prisma/driver-adapter-utils";

export const convertDialectColumnToEnum = (dialect: SQLDialect, column: string): ColumnType | null => {
  const columnType = column.toUpperCase();

  switch (dialect) {
    case 'postgresql': {
      switch (columnType) {
        case '': {
          return null
        }
        case 'DECIMAL': {
          return ColumnTypeEnum.Numeric
        }
        case 'FLOAT': {
          return ColumnTypeEnum.Float
        }
        case 'DOUBLE':
        case 'DOUBLE PRECISION':
        case 'NUMERIC':
        case 'REAL': {
          return ColumnTypeEnum.Double
        }
        case 'TINYINT':
        case 'SMALLINT':
        case 'MEDIUMINT':
        case 'INT':
        case 'INTEGER':
        case 'SERIAL':
        case 'INT2': {
          return ColumnTypeEnum.Int32
        }
        case 'BIGINT':
        case 'UNSIGNED BIG INT':
        case 'INT8': {
          return ColumnTypeEnum.Int64
        }
        case 'DATETIME':
        case 'TIMESTAMP': {
          return ColumnTypeEnum.DateTime
        }
        case 'TIME': {
          return ColumnTypeEnum.Time
        }
        case 'DATE': {
          return ColumnTypeEnum.Date
        }
        case 'TEXT':
        case 'CLOB':
        case 'CHARACTER':
        case 'VARCHAR':
        case 'VARYING CHARACTER':
        case 'NCHAR':
        case 'NATIVE CHARACTER':
        case 'NVARCHAR': {
          return ColumnTypeEnum.Text
        }
        case 'BLOB': {
          return ColumnTypeEnum.Bytes
        }
        case 'BOOLEAN': {
          return ColumnTypeEnum.Boolean
        }
        case 'JSONB': {
          return ColumnTypeEnum.Json
        }
        default: {
          return null
        }
      }
    }
    case 'libsql': {
      switch (columnType) {
        case '': {
          return null
        }
        case 'DECIMAL': {
          return ColumnTypeEnum.Numeric
        }
        case 'FLOAT': {
          return ColumnTypeEnum.Float
        }
        case 'DOUBLE':
        case 'DOUBLE PRECISION':
        case 'NUMERIC':
        case 'REAL': {
          return ColumnTypeEnum.Double
        }
        case 'TINYINT':
        case 'SMALLINT':
        case 'MEDIUMINT':
        case 'INT':
        case 'INTEGER':
        case 'SERIAL':
        case 'INT2': {
          return ColumnTypeEnum.Int32
        }
        case 'BIGINT':
        case 'UNSIGNED BIG INT':
        case 'INT8': {
          return ColumnTypeEnum.Int64
        }
        case 'DATETIME':
        case 'TIMESTAMP': {
          return ColumnTypeEnum.DateTime
        }
        case 'TIME': {
          return ColumnTypeEnum.Time
        }
        case 'DATE': {
          return ColumnTypeEnum.Date
        }
        case 'TEXT':
        case 'CLOB':
        case 'CHARACTER':
        case 'VARCHAR':
        case 'VARYING CHARACTER':
        case 'NCHAR':
        case 'NATIVE CHARACTER':
        case 'NVARCHAR': {
          return ColumnTypeEnum.Text
        }
        case 'BLOB': {
          return ColumnTypeEnum.Bytes
        }
        case 'BOOLEAN': {
          return ColumnTypeEnum.Boolean
        }
        case 'JSONB': {
          return ColumnTypeEnum.Json
        }
        default: {
          return null
        }
      }
    }
    case 'sqlite': {
      switch (columnType) {
        case '': {
          return null
        }
        case 'DECIMAL': {
          return ColumnTypeEnum.Numeric
        }
        case 'FLOAT': {
          return ColumnTypeEnum.Float
        }
        case 'DOUBLE':
        case 'DOUBLE PRECISION':
        case 'NUMERIC':
        case 'REAL': {
          return ColumnTypeEnum.Double
        }
        case 'TINYINT':
        case 'SMALLINT':
        case 'MEDIUMINT':
        case 'INT':
        case 'INTEGER':
        case 'SERIAL':
        case 'INT2': {
          return ColumnTypeEnum.Int32
        }
        case 'BIGINT':
        case 'UNSIGNED BIG INT':
        case 'INT8': {
          return ColumnTypeEnum.Int64
        }
        case 'DATETIME':
        case 'TIMESTAMP': {
          return ColumnTypeEnum.DateTime
        }
        case 'TIME': {
          return ColumnTypeEnum.Time
        }
        case 'DATE': {
          return ColumnTypeEnum.Date
        }
        case 'TEXT':
        case 'CLOB':
        case 'CHARACTER':
        case 'VARCHAR':
        case 'VARYING CHARACTER':
        case 'NCHAR':
        case 'NATIVE CHARACTER':
        case 'NVARCHAR': {
          return ColumnTypeEnum.Text
        }
        case 'BLOB': {
          return ColumnTypeEnum.Bytes
        }
        case 'BOOLEAN': {
          return ColumnTypeEnum.Boolean
        }
        case 'JSONB': {
          return ColumnTypeEnum.Json
        }
        default: {
          return null
        }
      }
    }
    default: {
        return null
    }
  }
}

export const getQueryArgs = (query: SqlQuery, options?: Record<string, unknown>): Array<bigint | Primitive | Buffer<ArrayBuffer>> => {
  return ((query.args || []) as Primitive[]).map((arg: Primitive | Date, i) => {
    const argType = query.argTypes[i]
    if (arg === null) {
      return null
    }

    if (typeof arg === 'string' && argType.scalarType === 'int') {
      return Number.parseInt(arg)
    }

    if (typeof arg === 'string' && argType.scalarType === 'float') {
      return Number.parseFloat(arg)
    }

    if (typeof arg === 'string' && argType.scalarType === 'decimal') {
      // This can lose precision, but SQLite does not have a native decimal type.
      // This is how we have historically handled it.
      return Number.parseFloat(arg)
    }

    if (typeof arg === 'string' && argType.scalarType === 'bigint') {
      return BigInt(arg)
    }

    if (typeof arg === 'boolean') {
      return arg ? 1 : 0 // SQLite does not natively support booleans
    }

    if (typeof arg === 'string' && argType.scalarType === 'datetime') {
      arg = new Date(arg)
    }

    if (arg instanceof Date) {
      const format = options?.timestampFormat ?? 'iso8601'
      switch (format) {
        case 'unixepoch-ms': {
          return arg.getTime()
        }
        case 'iso8601': {
          return arg.toISOString().replace('Z', '+00:00')
        }
        default: {
          throw new Error(`Unknown timestamp format: ${format}`)
        }
      }
    }

    if (typeof arg === 'string' && argType.scalarType === 'bytes') {
      return Buffer.from(arg, 'base64')
    }

    return arg
  })
}
