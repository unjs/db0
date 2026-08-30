import type { DatabaseConnection, QueryResult } from "kysely";

import type { CompiledQuery } from "kysely";

import type { Database, Primitive } from "db0";

export class DB0Connection implements DatabaseConnection {
  constructor(private db: Database) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const stmt = this.db.prepare(sql);

    const isMutation =
      compiledQuery.query.kind === "InsertQueryNode" ||
      compiledQuery.query.kind === "UpdateQueryNode" ||
      compiledQuery.query.kind === "DeleteQueryNode" ||
      compiledQuery.query.kind === "MergeQueryNode";

    if (
      isMutation &&
      !("returning" in compiledQuery.query && compiledQuery.query.returning)
    ) {
      // Mutation statements without RETURNING do not produce rows. Calling
      // Statement.all() is rejected by drivers such as better-sqlite3; run()
      // executes them and Kysely only needs an empty rows array here.
      await stmt.run(...(parameters as Primitive[]));
      return { rows: [] };
    }

    const rows = (await stmt.all(...(parameters as Primitive[]))) as R[];
    return {
      rows,
      // db0 does not expose numAffectedRows/insertId,
      // but rows from RETURNING give the needed info
      numAffectedRows: rows.length > 0 ? BigInt(rows.length) : undefined,
    };
  }

  // eslint-disable-next-line require-yield
  async *streamQuery<R>(
    _compiledQuery: CompiledQuery,
    _chunkSize?: number,
  ): AsyncIterableIterator<QueryResult<R>> {
    throw new Error("db0 does not support streaming queries.");
  }
}
