import pg from "pg";

import type { Connector, Primitive } from "db0";

import { BoundableStatement } from "./_internal/statement.ts";

export type ConnectorOptions = { url: string } | pg.ClientConfig;

type InternalQuery = (
  sql: string,
  params?: Primitive[],
) => Promise<pg.QueryResult>;

export default function postgresqlConnector(
  opts: ConnectorOptions,
): Connector<pg.Client> {
  let _client: undefined | pg.Client | Promise<pg.Client>;
  function getClient() {
    if (_client) {
      return _client;
    }
    const client = new pg.Client("url" in opts ? opts.url : opts);
    _client = client.connect().then(() => {
      _client = client;
      return _client;
    });
    return _client;
  }

  const query: InternalQuery = async (sql, params) => {
    const client = await getClient();
    return client.query(normalizeParams(sql), params);
  };

  return {
    name: "postgresql",
    dialect: "postgresql",
    getInstance: () => getClient(),
    exec: (sql) => query(sql),
    prepare: (sql) => new StatementWrapper(sql, query),
    dispose: async () => {
      await (await _client)?.end?.();
      _client = undefined;
    },
  };
}

/**
 * Replace `?` placeholders with PostgreSQL `$N` positional parameters,
 * while preserving literal `?` inside quoted strings and comments.
 *
 * Handles:
 * - Single-quoted strings (including escaped `''`)
 * - Dollar-quoted strings (`$$...$$` and `$tag$...$tag$`)
 * - Double-quoted identifiers
 * - Line comments (`--`)
 * - Block comments (`/* */`)
 */
function normalizeParams(sql: string) {
  const result: string[] = [];
  let i = 0;
  let paramIdx = 0;
  const n = sql.length;

  while (i < n) {
    // Single-quoted string
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (j + 1 < n && sql[j + 1] === "'") {
            j += 2; // escaped quote ''
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      result.push(sql.slice(i, j));
      i = j;
      continue;
    }

    // Dollar-quoted string (PostgreSQL): $tag$...$tag$ or $$...$$
    if (
      sql[i] === "$" &&
      i + 1 < n &&
      (sql[i + 1] === "$" || /[a-zA-Z_]/.test(sql[i + 1]))
    ) {
      let j = i + 1;
      if (sql[j] !== "$") {
        while (j < n && /[a-zA-Z0-9_]/.test(sql[j])) j++;
        if (j >= n || sql[j] !== "$") {
          result.push(sql[i]);
          i++;
          continue;
        }
      }
      const tag = sql.slice(i, j + 1);
      const end = sql.indexOf(tag, j + 1);
      if (end === -1) {
        result.push(sql.slice(i));
        break;
      }
      result.push(sql.slice(i, end + tag.length));
      i = end + tag.length;
      continue;
    }

    // Double-quoted identifier
    if (sql[i] === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      result.push(sql.slice(i, j));
      i = j;
      continue;
    }

    // Line comment --
    if (i + 1 < n && sql[i] === "-" && sql[i + 1] === "-") {
      const j = sql.indexOf("\n", i);
      if (j === -1) {
        result.push(sql.slice(i));
        break;
      }
      result.push(sql.slice(i, j));
      i = j;
      continue;
    }

    // Block comment /* */
    if (i + 1 < n && sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) {
        result.push(sql.slice(i));
        break;
      }
      result.push(sql.slice(i, end + 2));
      i = end + 2;
      continue;
    }

    // Parameter placeholder ?
    if (sql[i] === "?") {
      paramIdx++;
      result.push(`$${paramIdx}`);
      i++;
      continue;
    }

    result.push(sql[i]);
    i++;
  }

  return result.join("");
}

class StatementWrapper extends BoundableStatement<void> {
  #query: InternalQuery;
  #sql: string;

  constructor(sql: string, query: InternalQuery) {
    super();
    this.#sql = sql;
    this.#query = query;
  }

  async all(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.rows;
  }

  async run(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return {
      success: true,
      ...res,
    };
  }

  async get(...params: Primitive[]) {
    const res = await this.#query(this.#sql, params);
    return res.rows[0];
  }
}
