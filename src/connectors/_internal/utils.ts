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
};

export function lazyInstance<T>(factory: () => Promise<T>): LazyInstance<T> {
  const get = (() =>
    (get.current ??= factory().catch((error) => {
      get.current = undefined;
      throw error;
    }))) as LazyInstance<T>;
  get.current = undefined;
  get.reset = () => {
    get.current = undefined;
  };
  return get;
}
