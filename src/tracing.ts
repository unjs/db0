import type {
  Connector,
  Database,
  Primitive,
  SQLDialect,
  Statement,
} from "./types.ts";
import { sqlTemplate } from "./template.ts";

export type TracedOperation = "query";

/**
 * Name of the tracing channel every query is traced on.
 *
 * Subscribers can use it instead of hardcoding the string:
 * `tracingChannel<TraceContext>(QUERY_CHANNEL)`.
 */
export const QUERY_CHANNEL = "db0.query";

export interface TraceContext {
  query: string;
  method: "exec" | "sql" | "prepare.all" | "prepare.run" | "prepare.get";
  connector: Database["connector"];
  dialect: SQLDialect;
}

/**
 * Traces one query. The query string can be passed as a thunk so that building it
 * (e.g. parsing an `sql` template) is skipped when nobody is subscribed.
 */
type TraceQuery = <T>(
  exec: () => Promise<T>,
  method: TraceContext["method"],
  query: string | (() => string),
) => Promise<T>;

const TRACED: unique symbol = Symbol.for("db0.traced");

type MaybeTracedDatabase<TConnector extends Connector = Connector> =
  Database<TConnector> & {
    [TRACED]?: boolean;
  };

class TracedStatement implements Statement {
  #statement: Statement;
  #query: string;
  #traceQuery: TraceQuery;

  constructor(statement: Statement, query: string, traceQuery: TraceQuery) {
    this.#statement = statement;
    this.#query = query;
    this.#traceQuery = traceQuery;
  }

  bind(...args: Primitive[]): TracedStatement {
    return new TracedStatement(
      this.#statement.bind(...args),
      this.#query,
      this.#traceQuery,
    );
  }

  all(...args: Primitive[]): Promise<unknown[]> {
    return this.#traceQuery(
      async () => this.#statement.all(...args),
      "prepare.all",
      this.#query,
    );
  }

  run(...args: Primitive[]): Promise<{ success: boolean }> {
    return this.#traceQuery(
      async () => this.#statement.run(...args),
      "prepare.run",
      this.#query,
    );
  }

  get(...args: Primitive[]): Promise<unknown> {
    return this.#traceQuery(
      async () => this.#statement.get(...args),
      "prepare.get",
      this.#query,
    );
  }
}

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

  const queryChannel = tracingChannel<TraceContext>(QUERY_CHANNEL);

  // The context is built lazily to avoid any work when nobody is subscribed.
  // This is an async function so that subscribing never turns a rejection
  // (e.g. an invalid `sql` template) into a synchronous throw.
  async function traceQuery<T>(
    exec: () => Promise<T>,
    method: TraceContext["method"],
    query: string | (() => string),
  ): Promise<T> {
    if (!queryChannel.hasSubscribers) {
      return exec();
    }
    return queryChannel.tracePromise(exec, {
      query: typeof query === "function" ? query() : query,
      method,
      connector: db.connector,
      dialect: db.dialect,
    });
  }

  // Every member delegates explicitly instead of being copied over from `db`.
  // Copying property descriptors would snapshot own properties onto a foreign
  // object, which breaks databases implemented as classes (methods and getters
  // would run against a receiver that never got their private fields) and
  // freezes the wrapper's view of the original at wrap time. Delegating keeps
  // `db` as the receiver of every call, so getters like `disposed` always report
  // the current state.
  const tracedDb: Database<TConnector> = {
    get connector() {
      return db.connector;
    },

    get dialect() {
      return db.dialect;
    },

    get disposed() {
      return db.disposed;
    },

    getInstance: () => db.getInstance(),

    // `exec` is wrapped in an async function so connectors throwing synchronously
    // emit the same event sequence as connectors rejecting asynchronously. As a
    // side effect, `exec` on a disposed database rejects instead of throwing
    // synchronously; `exec` returns a promise either way, so awaiting is unaffected.
    exec: (query) => traceQuery(async () => db.exec(query), "exec", query),

    prepare: (query) =>
      new TracedStatement(db.prepare(query), query, traceQuery),

    sql: (strings, ...values) =>
      traceQuery(
        async () => db.sql(strings, ...values),
        "sql",
        () =>
          // Rebuilding the query keeps bound parameters out of the traced context.
          // This parses the template a second time (`db.sql` parses it again to
          // run it), which is a deliberate trade-off: the alternative is threading
          // precompiled SQL through `Database.sql`, and the cost is only paid when
          // somebody is subscribed.
          sqlTemplate(strings, ...values)[0],
      ),

    dispose: () => db.dispose(),

    [Symbol.asyncDispose]: () => db[Symbol.asyncDispose](),
  };

  // Non-enumerable, so spreading or serializing a traced database does not leak it.
  Object.defineProperty(tracedDb, TRACED, { value: true });

  return tracedDb;
}
