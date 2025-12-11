import type { Connector, Database, SQLDialect } from "./types.ts";
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

  const tracedDb: MaybeTracedDatabase<TConnector> = { ...db, __traced: true };

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

  /**
   * Prepare needs a special treatment because it returns a statement instance that needs to be patched.
   */
  tracedDb.prepare = (query) => {
    const statement = db.prepare(query);
    const tracedStatement = { ...statement };
    const partialContext = {
      query,
      dialect: db.dialect,
    };

    tracedStatement.all = (...params) =>
      tracePromise(() => statement.all(...params), {
        method: "prepare.all",
        ...partialContext,
      });

    tracedStatement.run = (...params) =>
      tracePromise(() => statement.run(...params), {
        method: "prepare.run",
        ...partialContext,
      });

    tracedStatement.get = (...params) =>
      tracePromise(() => statement.get(...params), {
        method: "prepare.get",
        ...partialContext,
      });

    return tracedStatement;
  };

  return tracedDb;
}
