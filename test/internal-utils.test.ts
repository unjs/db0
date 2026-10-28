import { describe, expect, it, vi } from "vitest";
import {
  discardOnError,
  importLib,
  interopDefault,
  lazyInstance,
} from "../src/connectors/_internal/utils";

describe("importLib", () => {
  const load = () => import("./fixtures/lib");

  it("dynamically imports the library by default", async () => {
    await expect(
      importLib("test", "lib", undefined, load),
    ).resolves.toMatchObject({ name: "lib" });
  });

  it("uses a provided module namespace", async () => {
    const lib = { name: "provided" };
    await expect(importLib("test", "lib", lib, load)).resolves.toBe(lib);
  });

  it("uses a provided (async) factory", async () => {
    const lib = { name: "provided" };
    await expect(importLib("test", "lib", () => lib, load)).resolves.toBe(lib);
    await expect(importLib("test", "lib", async () => lib, load)).resolves.toBe(
      lib,
    );
  });

  it("throws a descriptive error if the library cannot be imported", async () => {
    const cause = new Error("Cannot find module 'lib'");
    await expect(
      importLib("test", "lib", undefined, () => Promise.reject(cause)),
    ).rejects.toThrow(
      "[db0] [test] Cannot import `lib`. Make sure it is installed or provide it via the `lib` option.",
    );
    await expect(
      importLib("test", "lib", undefined, () => Promise.reject(cause)),
    ).rejects.toMatchObject({ cause });
  });
});

describe("interopDefault", () => {
  it("unwraps a CJS default export", () => {
    const mod = { foo: 1 };
    expect(interopDefault({ default: mod })).toBe(mod);
  });

  it("keeps namespaces without a default export", () => {
    const mod = { foo: 1 };
    expect(interopDefault(mod)).toBe(mod);
  });
});

describe("lazyInstance", () => {
  it("creates the instance once", async () => {
    const factory = vi.fn(async () => ({}));
    const get = lazyInstance(factory);
    expect(get.current).toBeUndefined();
    expect(await get()).toBe(await get());
    expect(factory).toHaveBeenCalledTimes(1);
    expect(await get.current).toBe(await get());
  });

  it("does not cache failures", async () => {
    let attempt = 0;
    const get = lazyInstance(async () => {
      if (attempt++ === 0) {
        throw new Error("nope");
      }
      return "ok";
    });
    await expect(get()).rejects.toThrow("nope");
    expect(get.current).toBeUndefined();
    await expect(get()).resolves.toBe("ok");
  });

  it("can be reset", async () => {
    const factory = vi.fn(async () => ({}));
    const get = lazyInstance(factory);
    const first = await get();
    get.reset();
    expect(get.current).toBeUndefined();
    expect(await get()).not.toBe(first);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("can fail the next access once", async () => {
    const factory = vi.fn(async () => ({}));
    const get = lazyInstance(factory);
    const first = await get();
    get.fail(new Error("gone"));
    expect(get.current).toBeUndefined();
    await expect(get()).rejects.toThrow("gone");
    expect(await get()).not.toBe(first);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe("discardOnError", () => {
  class FakeConnection {
    listeners: ((error: Error) => void)[] = [];
    ends = 0;
    inTransaction = false;
    on(_event: "error", listener: (error: Error) => void) {
      this.listeners.push(listener);
    }
    end() {
      this.ends++;
    }
    /**
     * Emit like Node's `EventEmitter`: an `'error'` without a listener throws
     * instead of passing silently, so a test that expects the event to be
     * handled fails when no listener was registered.
     */
    fail(error = new Error("connection terminated unexpectedly")) {
      if (this.listeners.length === 0) {
        throw error;
      }
      for (const listener of this.listeners) listener(error);
    }
  }

  /** The connector shape: register the listener before the connection is cached. */
  function connect(connections: FakeConnection[] = []) {
    const get = lazyInstance(async () => {
      const connection = new FakeConnection();
      discardOnError(get, connection, (c) => c.inTransaction);
      connections.push(connection);
      return connection;
    });
    return get;
  }

  it("swallows the error event instead of letting it reach Node", async () => {
    const get = connect();
    const connection = await get();
    expect(() => connection.fail()).not.toThrow();
  });

  it("forgets the failed connection so the next call reconnects", async () => {
    const get = connect();
    const first = await get();

    first.fail();
    await vi.waitFor(() => expect(get.current).toBeUndefined());

    expect(first.ends).toBe(1);
    expect(await get()).not.toBe(first);
  });

  it("does not discard a connection that already replaced the failed one", async () => {
    const get = connect();
    const first = await get();

    get.reset();
    const second = await get();

    // The old connection errors after being replaced: the live one must stay.
    first.fail();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(second.ends).toBe(0);
    expect(await get()).toBe(second);
  });

  it("does not discard a connection that replaced the failed one before the error was handled", async () => {
    const get = connect();
    const first = await get();

    // Replaced in the same tick, before the error handler gets to run.
    first.fail();
    get.reset();
    const second = get();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(get.current).toBe(second);
    expect(first.ends).toBe(0);
  });

  it("ignores a connection whose end() throws synchronously", async () => {
    const get = connect();
    const first = await get();
    first.end = () => {
      throw new Error("socket already closed");
    };

    expect(() => first.fail()).not.toThrow();
    await vi.waitFor(() => expect(get.current).toBeUndefined());

    expect(await get()).not.toBe(first);
  });

  it("fails the next query instead of reconnecting inside a transaction", async () => {
    const get = connect();
    const first = await get();
    first.inTransaction = true;

    const error = new Error(
      "terminating connection due to idle-in-transaction timeout",
    );
    first.fail(error);
    await vi.waitFor(() => expect(get.current).toBeUndefined());
    expect(first.ends).toBe(1);

    // The rest of the transaction must not autocommit on a fresh session.
    const rejection = await get().catch((error_) => error_);
    expect(rejection.message).toMatch("lost during a transaction");
    expect(rejection.cause).toBe(error);

    // The rollback that follows has consumed the failure: reconnect.
    expect(await get()).not.toBe(first);
  });
});
