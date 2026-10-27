import type { DatabaseConnection, QueryResult } from "kysely";

import type { CompiledQuery } from "kysely";

import type { Database, Primitive, Statement } from "db0";

export class DB0Connection implements DatabaseConnection {
  constructor(private db: Database) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, query } = compiledQuery;
    const parameters = compiledQuery.parameters as Primitive[];
    const stmt = this.db.prepare(sql);

    switch (query.kind) {
      case "SelectQueryNode": {
        const rows = (await stmt.all(...parameters)) as R[];
        return { rows };
      }
      case "InsertQueryNode":
      case "UpdateQueryNode":
      case "DeleteQueryNode":
      case "MergeQueryNode": {
        if (query.returning) {
          const rows = (await stmt.all(...parameters)) as R[];
          return {
            rows,
            // db0 does not expose numAffectedRows/insertId for row-returning
            // statements, but rows from RETURNING give the needed info
            numAffectedRows: rows.length > 0 ? BigInt(rows.length) : undefined,
          };
        }
        // Mutation statements without RETURNING do not produce rows. Calling
        // Statement.all() is rejected by drivers such as better-sqlite3.
        return runQuery(stmt, parameters, query.kind === "InsertQueryNode");
      }
      case "RawNode": {
        // Raw SQL may or may not return rows. better-sqlite3 rejects all() for
        // statements that do not, before executing them, so retry with run().
        try {
          const rows = (await stmt.all(...parameters)) as R[];
          return { rows };
        } catch (error) {
          if (!isNonReaderError(error)) {
            throw error;
          }
          return runQuery(stmt, parameters, false);
        }
      }
      default: {
        // Schema statements (CREATE / DROP / ALTER ...) never return rows.
        return runQuery(stmt, parameters, false);
      }
    }
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(
    _compiledQuery: CompiledQuery,
    _chunkSize?: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("db0 does not support streaming queries.");
  }
}

async function runQuery(
  stmt: Statement,
  parameters: Primitive[],
  isInsert: boolean,
): Promise<QueryResult<never>> {
  // Connectors spread the driver's native run() result, which names the
  // affected row count and last insert id differently per driver:
  // better-sqlite3 / node:sqlite / bun:sqlite (changes, lastInsertRowid),
  // libsql (rowsAffected, lastInsertRowid), pg / neon (rowCount),
  // pglite (affectedRows), mysql2 (affectedRows, changedRows, insertId),
  // planetscale (rowsAffected, insertId) and D1 (meta.changes, meta.last_row_id).
  const res = (await stmt.run(...parameters)) as Record<string, any>;
  const numAffectedRows = toBigInt(
    res.changes ??
      res.rowsAffected ??
      res.affectedRows ??
      res.rowCount ??
      res.meta?.changes,
  );
  const numChangedRows = toBigInt(res.changedRows);
  // MySQL reports insertId 0 when no auto-increment value was generated
  const insertId = isInsert
    ? toBigInt(
        res.lastInsertRowid ??
          (String(res.insertId) === "0" ? undefined : res.insertId) ??
          res.meta?.last_row_id,
      )
    : undefined;
  return {
    rows: [],
    numAffectedRows,
    ...(numChangedRows === undefined ? {} : { numChangedRows }),
    ...(insertId === undefined ? {} : { insertId }),
  };
}

function toBigInt(value: unknown): bigint | undefined {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  return undefined;
}

function isNonReaderError(error: unknown): boolean {
  return error instanceof Error && /does not return data/i.test(error.message);
}
