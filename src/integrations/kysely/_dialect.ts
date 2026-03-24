import type {
  DatabaseConnection,
  QueryResult,
} from "kysely";

import type { CompiledQuery } from "kysely";

import type { Database } from "db0";

export class DB0Connection implements DatabaseConnection {
  constructor(private db: Database) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const stmt = this.db.prepare(sql);

    if (
      compiledQuery.query.kind === "InsertQueryNode" ||
      compiledQuery.query.kind === "UpdateQueryNode" ||
      compiledQuery.query.kind === "DeleteQueryNode" ||
      compiledQuery.query.kind === "MergeQueryNode"
    ) {
      // For mutations that may return rows (RETURNING clause)
      const rows = (await stmt.all(
        ...(parameters as unknown[]),
      )) as R[];
      return {
        rows,
        // db0 doesn't expose numAffectedRows/insertId,
        // but rows from RETURNING give the needed info
        numAffectedRows: rows.length > 0 ? BigInt(rows.length) : undefined,
      };
    }

    const rows = (await stmt.all(...(parameters as unknown[]))) as R[];
    return { rows };
  }

  async *streamQuery<R>(
    _compiledQuery: CompiledQuery,
    _chunkSize?: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("db0 does not support streaming queries.");
  }
}
