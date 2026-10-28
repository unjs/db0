import type { LibImport } from "../../types.ts";

export type {
  ConnectorDependency,
  ConnectorDependencies,
  LibImport,
} from "../../types.ts";

/**
 * Resolve a third-party library used by a connector.
 *
 * Uses the user provided `lib` option when available, otherwise falls back to `load()`
 * (a dynamic import) and throws a descriptive error if it cannot be resolved.
 */
export async function importLib<T>(
  connector: string,
  name: string,
  lib: LibImport<T> | undefined,
  // NOTE: `any` since dynamic import types of CJS libs can differ from `typeof import(...)`
  load: () => Promise<any>,
): Promise<T> {
  if (lib) {
    return typeof lib === "function"
      ? await (lib as () => T | Promise<T>)()
      : lib;
  }
  try {
    return await load();
  } catch (cause) {
    throw new Error(
      `[db0] [${connector}] Cannot import \`${name}\`. Make sure it is installed or provide it via the \`lib\` option.`,
      { cause },
    );
  }
}

/**
 * Interop helper for CJS libraries that are exposed via a default export.
 */
export function interopDefault<T>(mod: T): T {
  return (mod as any)?.default ?? mod;
}

/**
 * A lazily created, cached instance.
 *
 * Calling it creates the instance on first access and caches the promise.
 * A failed creation is not cached, so the next call retries.
 */
export type LazyInstance<T> = (() => Promise<T>) & {
  /** The pending or resolved instance, or `undefined` if it was never created. */
  current: Promise<T> | undefined;
  /** Forget the cached instance so that it is created again on next access. */
  reset: () => void;
  /**
   * Forget the cached instance and reject the next access with `error`; the
   * access after that creates the instance again.
   */
  fail: (error: unknown) => void;
};

export function lazyInstance<T>(factory: () => Promise<T>): LazyInstance<T> {
  let failure: { error: unknown } | undefined;
  const get = (() => {
    if (failure) {
      const { error } = failure;
      failure = undefined;
      return Promise.reject(error);
    }
    return (get.current ??= factory().catch((error) => {
      get.current = undefined;
      throw error;
    }));
  }) as LazyInstance<T>;
  get.current = undefined;
  get.reset = () => {
    failure = undefined;
    get.current = undefined;
  };
  get.fail = (error) => {
    failure = { error };
    get.current = undefined;
  };
  return get;
}

type ErrorEmitter = {
  on: (event: "error", listener: (error: Error) => void) => unknown;
  end: () => unknown;
};

/**
 * Drop a cached connection from `instance` once it emits an `'error'` event.
 *
 * A driver connection that can emit `'error'` must always have a listener:
 * Node terminates the process on an unhandled `'error'` event, so a server-side
 * disconnect (a restart, a failover, an idle reaper) would otherwise take the
 * process down with it. Forgetting the connection also lets the next query
 * connect again instead of reusing one the server has already torn down.
 *
 * Reconnecting is only safe outside a transaction: the server rolled back the
 * open one with the session, so the rest of it would silently autocommit on the
 * new connection. When `inTransaction` reports one, the next query rejects
 * instead (integrations roll back on it) and only the one after reconnects.
 */
export function discardOnError<T extends ErrorEmitter>(
  instance: LazyInstance<T>,
  connection: T,
  inTransaction?: (connection: T) => boolean,
): void {
  connection.on("error", (error) => {
    const lostTransaction = inTransaction?.(connection) ?? false;
    const pending = instance.current;
    void pending?.then(
      (current) => {
        // Only forget this connection: a later one may already have replaced it.
        if (current !== connection || instance.current !== pending) {
          return;
        }
        if (lostTransaction) {
          instance.fail(
            new Error(
              "[db0] The connection was lost during a transaction and the server rolled it back. The next query uses a new connection.",
              { cause: error },
            ),
          );
        } else {
          instance.reset();
        }
        // Release the socket. A connection that has already gone away ends
        // without complaint, so failures here are nothing to report. `end()`
        // may also throw synchronously, so call it inside the chain to keep
        // that from rejecting the detached promise below.
        void Promise.resolve()
          .then(() => connection.end())
          .catch(() => {});
      },
      () => {},
    );
  });
}
