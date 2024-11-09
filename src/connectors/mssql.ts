import {
    Connection,
    Request,
    Connection as TediousConnection,
    type ConnectionConfiguration,
    TYPES,
} from "tedious";
import type { DataType } from "tedious/lib/data-type";

import type { Connector, Statement } from "../types";

export default function mssqlConnector(opts: ConnectionConfiguration) {
  let _client: undefined | TediousConnection;
  async function getClient(): Promise<TediousConnection> {
    if (_client && _client.state === _client.STATE.LOGGED_IN) {
      return _client;
    }
    
    return new Promise((resolve, reject) => {
      const client = new Connection(opts);
      client.connect((error) => {
        if (error) {
          reject(error);
        }
        
        _client = client;
      });
      
      client.on('connect', () => resolve(_client));
      client.on('error', reject);
      client.on('end', () =>client.close());
    });
  };
  
  // taken from the `kysely` library: https://github.com/kysely-org/kysely/blob/413a88516c20be42dc8cbebade68c27669a3ac1a/src/dialect/mssql/mssql-driver.ts#L440
  function getTediousDataType(value: unknown): DataType {
    if (value === null || value === undefined || typeof value === 'string') {
      return TYPES.NVarChar;
    }
    
    if (typeof value === 'bigint' || (typeof value === 'number' && value % 1 === 0)) {
      return value < -2_147_483_648 || value > 2_147_483_647 ? TYPES.BigInt : TYPES.Int;
    }
    
    if (typeof value === 'number') {
      return TYPES.Float;
    }
    
    if (typeof value === 'boolean') {
      return TYPES.Bit;
    }
    
    if (value instanceof Date) {
      return TYPES.DateTime;
    }
    
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
      return TYPES.VarBinary;
    }
    
    return TYPES.NVarChar;
  }
  
  function prepareSqlParameters(sql: string, parameters: Record<string, unknown>[]) {
    const parameterIndexes = [];
    const tokens = [...sql];
    
    for (let i = 0; i < sql.length; i++) {
      const token = tokens[i];
      
      if (token === '?') {
        parameterIndexes.push(i);
      }
    };
    
    const namedParameters = {};
    for (const [index, parameterIndex] of parameterIndexes.entries()) {
      tokens[parameterIndex] = `@${index + 1}`;
      namedParameters[`@${index + 1}`] = {
        name: String(index + 1),
        type: getTediousDataType(parameters[index]),
        value: parameters[index],
      };
    }
    
    return {
      sql: tokens.join(''),
      parameters: namedParameters,
    };
  };
  
  async function _run(sql: string, parameters: Record<string, unknown>[]) {
    const connection = await getClient();
    const {
      sql: _sql,
      parameters: _parameters,
    } = prepareSqlParameters(sql, parameters);
    
    const query = new Promise<{ rows: unknown[], success: boolean }>((resolve, reject) => {
      let success = false;
      const request = new Request(_sql, (error) => {
        if (error) {
          reject(error);
        } else {
          success = true;
        }
      });
      
      const parameterKeys = Object.keys(_parameters);
      for (const key of parameterKeys) {
        const parameter = _parameters[key];
        
        request.addParameter(
          parameter.name,
          parameter.type,
          parameter.value
        );
      }
      
      const rows: unknown[] = [];
      request.on('row', (columns = []) => {
        const currentRow = {};
        for (const column of columns) {
          const { value, metadata } = column;
          const { colName } = metadata;
          
          currentRow[colName] = value;
        }
        
        rows.push(currentRow);
      });
      
      request.on('requestCompleted', () => {
        connection.close();
        resolve({ rows, success });
      });
      
      request.on('error', (error) => {
        connection.close();
        reject(error);
      });
      
      return connection.execSql(request);
    });
    
    try {
      const {
        rows,
        success,
      } = await query;
      
      return {
        rows,
        success,
      };
    } catch (error) {
      error.sql = _sql;
      error.parameters = parameters;
      console.error('Query failed:', error);
    }
  }
  
  return <Connector>{
    name: "mssql",
    dialect: "mssql",
    exec(sql: string) {
      return _run(sql, []);
    },
    prepare(sql: string) {
      const stmt = <Statement>{
        _sql: sql,
        _params: [],
        bind(...params) {
          if (params.length > 0) {
            this._params = params;
          }
          return stmt;
        },
        async all(...params) {
          const { rows } = await _run(this._sql, params || this._params);
          return rows;
        },
        async run(...params) {
          const {
            rows,
            success,
          } = await _run(this._sql, params || this._params);
          
          return {
            success,
            result: rows,
          };
        },
        async get(...params) {
          const { rows: [ row ] } = await _run(this._sql, params || this._params);
          return row;
        },
      };
      return stmt;
    },
  };
};
