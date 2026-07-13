import type { ConnectorName } from "./_connectors.ts";
import type {
  Connector,
  Database,
  Primitive,
  SQLDialect,
  Statement,
} from "./types.ts";
import { sqlTemplate } from "./template.ts";

export type TracedOperation = "query";

const QUERY_OPERATION: TracedOperation = "query";

export interface TraceContext {
  query: string;
  method: "exec" | "sql" | "prepare.all" | "prepare.run" | "prepare.get";
  connector: ConnectorName;
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

  const queryChannel = tracingChannel<TraceContext>(`db0.${QUERY_OPERATION}`);

  // The context is built lazily to avoid any work when nobody is subscribed.
  function tracePromise<T>(
    exec: () => Promise<T>,
    context: () => TraceContext,
  ): Promise<T> {
    if (!queryChannel.hasSubscribers) {
      return exec();
    }
    return queryChannel.tracePromise(exec, context());
  }

  // Use Object.create to preserve getter properties like `dialect` and `disposed`
  // The spread operator would evaluate getters at spread-time, making `disposed`
  // always return the initial value rather than the current state.
  const tracedDb = Object.create(db) as MaybeTracedDatabase<TConnector>;
  tracedDb.__traced = true;

  // `exec` is wrapped in an async function so connectors throwing synchronously
  // emit the same event sequence as connectors rejecting asynchronously.
  tracedDb.exec = (query) =>
    tracePromise(
      async () => db.exec(query),
      () => ({
        query,
        method: "exec",
        connector: db.connector,
        dialect: db.dialect,
      }),
    );

  tracedDb.sql = (strings, ...values) =>
    tracePromise(
      async () => db.sql(strings, ...values),
      () => ({
        query: sqlTemplate(strings, ...values)[0],
        method: "sql",
        connector: db.connector,
        dialect: db.dialect,
      }),
    );

  class TracedStatement implements Statement {
    #statement: Statement;
    #query: string;

    constructor(statement: Statement, query: string) {
      this.#statement = statement;
      this.#query = query;
    }

    #withTrace<T>(
      fn: () => Promise<T>,
      method: "prepare.all" | "prepare.run" | "prepare.get",
    ) {
      return tracePromise(fn, () => ({
        query: this.#query,
        method,
        connector: db.connector,
        dialect: db.dialect,
      }));
    }

    bind(...args: Primitive[]) {
      return new TracedStatement(this.#statement.bind(...args), this.#query);
    }

    all(...args: Primitive[]) {
      return this.#withTrace(
        async () => this.#statement.all(...args),
        "prepare.all",
      );
    }

    run(...args: Primitive[]) {
      return this.#withTrace(
        async () => this.#statement.run(...args),
        "prepare.run",
      );
    }

    get(...args: Primitive[]) {
      return this.#withTrace(
        async () => this.#statement.get(...args),
        "prepare.get",
      );
    }
  }

  /**
   * Prepare needs a special treatment because it returns a statement instance that needs to be patched.
   */
  tracedDb.prepare = (query) => new TracedStatement(db.prepare(query), query);

  return tracedDb;
}
