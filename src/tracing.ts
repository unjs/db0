import type {
  Connector,
  Database,
  Primitive,
  SQLDialect,
  Statement,
} from "./types.ts";
import { sqlTemplate } from "./template.ts";

export type TracedOperation = "query";

export interface TraceContext {
  query: string;
  method: "exec" | "sql" | "prepare.all" | "prepare.run" | "prepare.get";
  dialect: SQLDialect;
}

type MaybeTracedDatabase<TConnector extends Connector = Connector> =
  Database<TConnector> & {
    __traced?: boolean;
  };

/**
 * Wrap a database instance with tracing functionality.
 */
export function withTracing<TConnector extends Connector = Connector>(
  db: MaybeTracedDatabase<TConnector>,
): Database<TConnector> {
  // Avoids double patching
  if (db.__traced) {
    return db;
  }

  const { tracingChannel } =
    globalThis.process?.getBuiltinModule?.("node:diagnostics_channel") || {};
  if (!tracingChannel) {
    return db;
  }

  const queryChannel = tracingChannel(`db0.query`);

  async function tracePromise<T>(
    exec: () => Promise<T>,
    data: TraceContext,
  ): Promise<T> {
    // TODO: Remove this cast once the @types/node types are updated.
    // The @types/node types incorrectly mark tracePromise as returning void,
    // but according to the JSDoc and actual implementation, it returns the promise.
    // This is fixed in later versions of Node.js.
    // See: https://nodejs.org/api/diagnostics_channel.html#channelstracepromisefn-context-thisarg-args
    return queryChannel.tracePromise(exec, data) as unknown as Promise<T>;
  }

  // Use Object.create to preserve getter properties like `dialect` and `disposed`
  // The spread operator would evaluate getters at spread-time, making `disposed`
  // always return the initial value rather than the current state.
  const tracedDb = Object.create(db) as MaybeTracedDatabase<TConnector>;
  tracedDb.__traced = true;

  tracedDb.exec = (query) =>
    tracePromise(() => db.exec(query), {
      query,
      method: "exec",
      dialect: db.dialect,
    });

  tracedDb.sql = (strings, ...values) =>
    tracePromise(() => db.sql(strings, ...values), {
      query: sqlTemplate(strings, ...values)[0],
      method: "sql",
      dialect: db.dialect,
    });

  class TracedStatement implements Statement {
    #statement: Statement;
    #query: string;

    constructor(statement: Statement, query: string) {
      this.#statement = statement;
      this.#query = query;
    }

    private withTrace<T>(
      fn: () => Promise<T>,
      method: "prepare.all" | "prepare.run" | "prepare.get",
    ) {
      return tracePromise(() => fn(), {
        method,
        query: this.#query,
        dialect: db.dialect,
      });
    }

    bind(...args: Primitive[]) {
      return new TracedStatement(this.#statement.bind(...args), this.#query);
    }

    all(...args: Primitive[]) {
      return this.withTrace(() => this.#statement.all(...args), "prepare.all");
    }

    run(...args: Primitive[]) {
      return this.withTrace(() => this.#statement.run(...args), "prepare.run");
    }

    get(...args: Primitive[]) {
      return this.withTrace(() => this.#statement.get(...args), "prepare.get");
    }
  }

  /**
   * Prepare needs a special treatment because it returns a statement instance that needs to be patched.
   */
  tracedDb.prepare = (query) => new TracedStatement(db.prepare(query), query);

  return tracedDb;
}
