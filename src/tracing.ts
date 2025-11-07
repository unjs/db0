import { type TracingChannel, tracingChannel } from "node:diagnostics_channel";
import type { Connector, Database } from "./types.ts";
import { sqlTemplate } from "./template.ts";

export type TracedOperation = "query";

export interface TraceContext {
  query: string;
  method: "exec" | "sql" | "prepare.all" | "prepare.run" | "prepare.get";
}

const channels: Record<TracedOperation, TracingChannel> = {
  query: createChannel("query"),
};

/**
 * Create a tracing channel for a given operation.
 */
function createChannel(operation: TracedOperation) {
  return tracingChannel(`db0.${operation}`);
}

/**
 * Trace a promise with a given operation and data.
 */
async function tracePromise<T>(
  operation: TracedOperation,
  exec: () => Promise<T>,
  data: TraceContext,
): Promise<T> {
  const channel = channels[operation];

  // TODO: Remove this cast once the @types/node types are updated.
  // The @types/node types incorrectly mark tracePromise as returning void,
  // but according to the JSDoc and actual implementation, it returns the promise.
  // This is fixed in later versions of Node.js.
  // See: https://nodejs.org/api/diagnostics_channel.html#channelstracepromisefn-context-thisarg-args
  return channel.tracePromise(exec, data) as unknown as Promise<T>;
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

  const tracedDb: MaybeTracedDatabase<TConnector> = { ...db, __traced: true };

  tracedDb.exec = (query) =>
    tracePromise("query", () => db.exec(query), { query, method: "exec" });

  tracedDb.sql = (strings, ...values) =>
    tracePromise("query", () => db.sql(strings, ...values), {
      query: sqlTemplate(strings, ...values)[0],
      method: "sql",
    });

  /**
   * Prepare needs a special treatment because it returns a statement instance that needs to be patched.
   */
  tracedDb.prepare = (query) => {
    const statement = db.prepare(query);
    const tracedStatement = { ...statement };

    tracedStatement.all = (...params) =>
      tracePromise("query", () => statement.all(...params), {
        query,
        method: "prepare.all",
      });

    tracedStatement.run = (...params) =>
      tracePromise("query", () => statement.run(...params), {
        query,
        method: "prepare.run",
      });

    tracedStatement.get = (...params) =>
      tracePromise("query", () => statement.get(...params), {
        query,
        method: "prepare.get",
      });

    return tracedStatement;
  };

  return tracedDb;
}
