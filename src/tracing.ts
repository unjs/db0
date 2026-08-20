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
  connector: Database["connector"];
  dialect: SQLDialect;
}

const TRACED: unique symbol = Symbol.for("db0.traced");

type MaybeTracedDatabase<TConnector extends Connector = Connector> =
  Database<TConnector> & {
    [TRACED]?: boolean;
  };

/**
 * Wrap a database instance with tracing functionality.
 */
export function withTracing<TConnector extends Connector = Connector>(
  db: Database<TConnector>,
): Database<TConnector> {
  // Avoids double patching
  if ((db as MaybeTracedDatabase<TConnector>)[TRACED]) {
    return db;
  }

  // Runtimes disagree on what `getBuiltinModule` does with a module they do not
  // implement (return `undefined` or throw), so tracing degrades either way.
  let tracingChannel:
    typeof import("node:diagnostics_channel").tracingChannel | undefined;
  try {
    tracingChannel = globalThis.process?.getBuiltinModule?.(
      "node:diagnostics_channel",
    )?.tracingChannel;
  } catch {
    tracingChannel = undefined;
  }
  if (!tracingChannel) {
    return db;
  }

  const queryChannel = tracingChannel<TraceContext>(`db0.${QUERY_OPERATION}`);

  // The context is built lazily to avoid any work when nobody is subscribed.
  // This is an async function so that subscribing never turns a rejection
  // (e.g. an invalid `sql` template) into a synchronous throw.
  async function tracePromise<T>(
    exec: () => Promise<T>,
    context: () => TraceContext,
  ): Promise<T> {
    if (!queryChannel.hasSubscribers) {
      return exec();
    }
    return queryChannel.tracePromise(exec, context());
  }

  // Copy the property descriptors instead of spreading, so that getters like
  // `dialect` and `disposed` stay getters. Spreading would evaluate them once,
  // making `disposed` report the state at wrap-time forever after. The prototype
  // is kept so that databases implemented as class instances keep their methods.
  const tracedDb = Object.create(
    Object.getPrototypeOf(db) as object | null,
    Object.getOwnPropertyDescriptors(db),
  ) as MaybeTracedDatabase<TConnector>;
  // Non-enumerable, so spreading or serializing a traced database does not leak it.
  Object.defineProperty(tracedDb, TRACED, { value: true });

  // `exec` is wrapped in an async function so connectors throwing synchronously
  // emit the same event sequence as connectors rejecting asynchronously. As a
  // side effect, `exec` on a disposed database rejects instead of throwing
  // synchronously; `exec` returns a promise either way, so awaiting is unaffected.
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
