import {
  describe,
  it,
  expect,
  afterEach,
  beforeEach,
  onTestFinished,
  vi,
} from "vitest";
import { tracingChannel } from "node:diagnostics_channel";
import { createDatabase } from "../src/database.ts";
import { withTracing } from "../src/tracing.ts";
import type { Database } from "../src/types.ts";
import type { TracedOperation, TraceContext } from "../src/tracing.ts";
import connector from "../src/connectors/better-sqlite3.ts";

type TracingEvent = {
  start?: { data: TraceContext };
  end?: { data: TraceContext };
  asyncStart?: { data: TraceContext };
  asyncEnd?: { data: TraceContext; result?: any; error?: Error };
  error?: { data: TraceContext; error: Error };
};

function createTracingListener(operationName: TracedOperation) {
  const events: TracingEvent = {};

  // Create tracing channel
  const channel = tracingChannel(`db0.${operationName}`);

  // Create handlers
  const startHandler = vi.fn((message: any) => {
    events.start = { data: message };
  });

  const endHandler = vi.fn((message: any) => {
    events.end = { data: message };
  });

  const asyncStartHandler = vi.fn((message: any) => {
    events.asyncStart = { data: message };
  });

  const asyncEndHandler = vi.fn((message: any) => {
    events.asyncEnd = {
      data: message,
      result: message.result,
      error: message.error,
    };
  });

  const errorHandler = vi.fn((message: any) => {
    events.error = { data: message, error: message.error };
  });

  // Subscribe using the subscribe method which listens to all events
  channel.subscribe({
    start: startHandler,
    end: endHandler,
    asyncStart: asyncStartHandler,
    asyncEnd: asyncEndHandler,
    error: errorHandler,
  });

  // Diagnostics channels are process-global, so a leaked subscriber would
  // affect every following test.
  onTestFinished(() => {
    channel.unsubscribe({
      start: startHandler,
      end: endHandler,
      asyncStart: asyncStartHandler,
      asyncEnd: asyncEndHandler,
      error: errorHandler,
    });
  });

  return {
    events,
    handlers: {
      start: startHandler,
      end: endHandler,
      asyncStart: asyncStartHandler,
      asyncEnd: asyncEndHandler,
      error: errorHandler,
    },
  };
}

describe("tracing", () => {
  let db: Database;

  beforeEach(async () => {
    const plainDb = createDatabase(
      connector({
        name: ":memory:",
      }),
    );
    db = withTracing(plainDb);

    // Create a test table
    await db.exec(
      `CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`,
    );
  });

  afterEach(async () => {
    await db.dispose();
  });

  describe("opt-in behavior", () => {
    it("should not emit tracing events without withTracing wrapper", async () => {
      const plainDb = createDatabase(
        connector({
          name: ":memory:",
        }),
      );
      const listener = createTracingListener("query");

      await plainDb.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY)`);
      await plainDb.sql`SELECT * FROM test`;

      // No tracing events should be emitted
      expect(listener.handlers.start).not.toHaveBeenCalled();
      expect(listener.handlers.end).not.toHaveBeenCalled();
      expect(listener.handlers.asyncStart).not.toHaveBeenCalled();
      expect(listener.handlers.asyncEnd).not.toHaveBeenCalled();
      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should prevent double tracing when wrapped multiple times", async () => {
      const plainDb = createDatabase(
        connector({
          name: ":memory:",
        }),
      );
      const tracedOnce = withTracing(plainDb);
      const tracedTwice = withTracing(tracedOnce);

      const listener = createTracingListener("query");

      await tracedTwice.exec(`CREATE TABLE test (id INTEGER PRIMARY KEY)`);

      // Should only be called once, not twice
      expect(listener.handlers.start).toHaveBeenCalledTimes(1);
      expect(listener.handlers.end).toHaveBeenCalledTimes(1);
      expect(listener.handlers.asyncStart).toHaveBeenCalledTimes(1);
      expect(listener.handlers.asyncEnd).toHaveBeenCalledTimes(1);
      await tracedOnce.dispose();
    });

    it("should behave like an untraced database when nobody is subscribed", async () => {
      // No listener is created here, so the tracing fast path is used
      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );

      const result = await db.sql`SELECT * FROM users WHERE id = ${1}`;
      expect(result.rows).toHaveLength(1);

      const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(1);
      expect((row as any).name).toBe("John Doe");

      await expect(
        db.exec(`SELECT * FROM non_existing_table`),
      ).rejects.toThrow();
    });

    it("should reject, never throw synchronously, on an invalid sql template", () => {
      createTracingListener("query");

      // Subscribing must not turn a rejection into a synchronous throw
      expect(() => (db.sql as any)("SELECT 1").catch(() => {})).not.toThrow();
    });

    it("should return the database unchanged without diagnostics channels", () => {
      const plainDb = createDatabase(connector({ name: ":memory:" }));

      const missing = vi
        .spyOn(process, "getBuiltinModule")
        .mockReturnValue(undefined as any);
      expect(withTracing(plainDb)).toBe(plainDb);

      // Runtimes that reject unknown builtin ids must degrade the same way.
      missing.mockImplementation(() => {
        throw new Error("unsupported builtin");
      });
      expect(withTracing(plainDb)).toBe(plainDb);

      missing.mockRestore();
    });

    it("should keep prototype methods of class based databases", () => {
      class ClassDatabase {
        get connector() {
          return "sqlite" as const;
        }
        get dialect() {
          return "sqlite" as const;
        }
        get disposed() {
          return false;
        }
        getInstance() {
          return Promise.resolve({} as any);
        }
        exec() {
          return Promise.resolve();
        }
        prepare() {
          return {} as any;
        }
        sql() {
          return Promise.resolve({} as any);
        }
        dispose() {
          return Promise.resolve();
        }
        [Symbol.asyncDispose]() {
          return this.dispose();
        }
      }

      const traced = withTracing(new ClassDatabase() as unknown as Database);

      expect(typeof traced.dispose).toBe("function");
      expect(typeof traced[Symbol.asyncDispose]).toBe("function");
      expect(typeof traced.getInstance).toBe("function");
      expect(traced.dialect).toBe("sqlite");
    });

    it("should not leak internal properties of the traced instance", () => {
      const plainDb = createDatabase(connector({ name: ":memory:" }));
      const tracedDb = withTracing(plainDb);

      expect(JSON.stringify(tracedDb)).toBe(JSON.stringify(plainDb));
    });
  });

  describe("trace context", () => {
    it("should not include bound parameters", async () => {
      const listener = createTracingListener("query");

      const secret = "super-secret@example.com";
      await db.sql`SELECT * FROM users WHERE email = ${secret}`;
      await db.prepare("SELECT * FROM users WHERE email = ?").all(secret);

      const traced = listener.handlers.start.mock.calls.map(
        (call) => call[0].query,
      );
      expect(traced.length).toBeGreaterThanOrEqual(2);
      for (const query of traced) {
        expect(query).not.toContain(secret);
      }
    });

    it("should emit events in order on success", async () => {
      const order: string[] = [];
      const listener = createTracingListener("query");
      for (const [name, handler] of Object.entries(listener.handlers)) {
        handler.mockImplementation(() => {
          order.push(name);
        });
      }

      await db.sql`SELECT * FROM users`;

      expect(order).toEqual(["start", "end", "asyncStart", "asyncEnd"]);
    });

    it("should emit events in order on failure", async () => {
      const order: string[] = [];
      const listener = createTracingListener("query");
      for (const [name, handler] of Object.entries(listener.handlers)) {
        handler.mockImplementation(() => {
          order.push(name);
        });
      }

      await expect(
        db.exec(`SELECT * FROM non_existing_table`),
      ).rejects.toThrow();

      expect(order).toEqual([
        "start",
        "end",
        "error",
        "asyncStart",
        "asyncEnd",
      ]);
    });
  });

  describe("getter properties", () => {
    it("should preserve dialect getter from original database", () => {
      const plainDb = createDatabase(
        connector({
          name: ":memory:",
        }),
      );
      const tracedDb = withTracing(plainDb);

      expect(tracedDb.dialect).toBe("sqlite");
      expect(tracedDb.dialect).toBe(plainDb.dialect);
    });

    it("should preserve disposed getter and reflect current state", async () => {
      const plainDb = createDatabase(
        connector({
          name: ":memory:",
        }),
      );
      const tracedDb = withTracing(plainDb);

      // Initially not disposed
      expect(tracedDb.disposed).toBe(false);
      expect(tracedDb.disposed).toBe(plainDb.disposed);

      // Dispose the database
      await tracedDb.dispose();

      // disposed should now be true (testing the getter reflects current state)
      expect(tracedDb.disposed).toBe(true);
      expect(tracedDb.disposed).toBe(plainDb.disposed);
    });

    it("should reflect disposed state when original db is disposed", async () => {
      const plainDb = createDatabase(
        connector({
          name: ":memory:",
        }),
      );
      const tracedDb = withTracing(plainDb);

      expect(tracedDb.disposed).toBe(false);

      // Dispose via the original database
      await plainDb.dispose();

      // tracedDb.disposed should reflect the change
      expect(tracedDb.disposed).toBe(true);
    });
  });

  describe("exec", () => {
    it("should emit correct tracing events on success", async () => {
      const listener = createTracingListener("query");

      const result = await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );

      expect(result).toBeDefined();
      expect(listener.handlers.start).toHaveBeenCalledTimes(1);
      expect(listener.handlers.end).toHaveBeenCalledTimes(1);
      expect(listener.handlers.asyncStart).toHaveBeenCalledTimes(1);
      expect(listener.handlers.asyncEnd).toHaveBeenCalledTimes(1);
      expect(listener.handlers.error).not.toHaveBeenCalled();

      expect(listener.events.start?.data.query).toContain("INSERT INTO users");
      expect(listener.events.start?.data.method).toBe("exec");
      expect(listener.events.start?.data.connector).toBe("sqlite");
      expect(listener.events.start?.data.dialect).toBe("sqlite");
    });

    it("should emit error event on failure", async () => {
      const listener = createTracingListener("query");

      await expect(
        db.exec(`INSERT INTO non_existing_table VALUES (1, 'test')`),
      ).rejects.toThrow();

      expect(listener.handlers.start).toHaveBeenCalledTimes(1);
      // Connectors throwing synchronously emit the same events as async ones
      expect(listener.handlers.asyncStart).toHaveBeenCalledTimes(1);
      expect(listener.handlers.asyncEnd).toHaveBeenCalledTimes(1);
      expect(listener.events.asyncEnd?.error).toBeDefined();
      expect(listener.handlers.error).toHaveBeenCalledTimes(1);
      expect(listener.events.error?.error).toBeDefined();
      expect(listener.events.error?.data.query).toContain(
        "INSERT INTO non_existing_table",
      );
      expect(listener.events.error?.data.method).toBe("exec");
      expect(listener.events.error?.data.connector).toBe("sqlite");
      expect(listener.events.error?.data.dialect).toBe("sqlite");
    });
  });

  describe("sql", () => {
    it("should emit correct tracing events on SELECT success", async () => {
      const listener = createTracingListener("query");

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );

      const result = await db.sql`SELECT * FROM users WHERE id = ${1}`;

      expect(result.rows).toHaveLength(1);
      expect(listener.handlers.start).toHaveBeenCalled();
      expect(listener.handlers.end).toHaveBeenCalled();
      expect(listener.handlers.asyncStart).toHaveBeenCalled();
      expect(listener.handlers.asyncEnd).toHaveBeenCalled();
      expect(listener.handlers.error).not.toHaveBeenCalled();

      // Find the SELECT query event
      const selectCalls = listener.handlers.start.mock.calls.filter((call) =>
        call[0].query.includes("SELECT"),
      );
      expect(selectCalls.length).toBeGreaterThan(0);
      expect(selectCalls[0][0].method).toBe("sql");
      expect(selectCalls[0][0].query).toContain("SELECT * FROM users");
      expect(selectCalls[0][0].dialect).toBe("sqlite");
    });

    it("should emit correct tracing events on INSERT with RETURNING", async () => {
      const listener = createTracingListener("query");

      const result =
        await db.sql`INSERT INTO users (id, name, email) VALUES (${2}, ${"Jane Doe"}, ${"jane@example.com"}) RETURNING *`;

      expect(result.rows).toHaveLength(1);
      expect(listener.handlers.start).toHaveBeenCalled();
      expect(listener.handlers.end).toHaveBeenCalled();
      expect(listener.handlers.asyncStart).toHaveBeenCalled();
      expect(listener.handlers.asyncEnd).toHaveBeenCalled();
      expect(listener.handlers.error).not.toHaveBeenCalled();

      // Find the INSERT query event
      const insertCalls = listener.handlers.start.mock.calls.filter((call) =>
        call[0].query.includes("INSERT"),
      );
      expect(insertCalls.length).toBeGreaterThan(0);
      expect(insertCalls[0][0].method).toBe("sql");
      expect(insertCalls[0][0].query).toContain("INSERT INTO users");
      expect(insertCalls[0][0].query).toContain("RETURNING");
      expect(insertCalls[0][0].dialect).toBe("sqlite");
    });

    it("should emit error event on failure", async () => {
      const listener = createTracingListener("query");

      await expect(
        db.sql`SELECT * FROM non_existing_table WHERE id = ${1}`,
      ).rejects.toThrow();

      expect(listener.handlers.start).toHaveBeenCalledTimes(1);
      expect(listener.handlers.asyncStart).toHaveBeenCalledTimes(1);
      expect(listener.handlers.error).toHaveBeenCalledTimes(1);
      expect(listener.events.error?.error).toBeDefined();
      expect(listener.events.error?.data.query).toContain(
        "SELECT * FROM non_existing_table",
      );
      expect(listener.events.error?.data.method).toBe("sql");
      expect(listener.events.error?.data.dialect).toBe("sqlite");
    });
  });

  describe("prepare.all", () => {
    it("should emit correct tracing events on success", async () => {
      const listener = createTracingListener("query");

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );
      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (2, 'Jane Doe', 'jane@example.com')`,
      );

      const stmt = db.prepare("SELECT * FROM users WHERE id > ?");
      const rows = await stmt.all(0);

      expect(rows).toHaveLength(2);

      // Find the prepare.all query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.all",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].query).toContain("SELECT * FROM users");
      expect(prepareCalls[0][0].method).toBe("prepare.all");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");

      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should emit error event on failure", async () => {
      const listener = createTracingListener("query");

      const stmt = db.prepare("SELECT * FROM non_existing_table WHERE id = ?");

      await expect(stmt.all(1)).rejects.toThrow();

      const prepareCalls = listener.handlers.error.mock.calls.filter(
        (call) => call[0].method === "prepare.all",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].error).toBeDefined();
      expect(prepareCalls[0][0].query).toContain(
        "SELECT * FROM non_existing_table",
      );
      expect(prepareCalls[0][0].method).toBe("prepare.all");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");
    });
  });

  describe("prepare.run", () => {
    it("should emit correct tracing events on success", async () => {
      const listener = createTracingListener("query");

      const stmt = db.prepare(
        "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
      );
      const result = await stmt.run(3, "Bob Smith", "bob@example.com");

      expect(result).toBeDefined();

      // Find the prepare.run query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.run",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].query).toContain("INSERT INTO users");
      expect(prepareCalls[0][0].method).toBe("prepare.run");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");

      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should emit error event on failure", async () => {
      const listener = createTracingListener("query");

      const stmt = db.prepare(
        "INSERT INTO non_existing_table (id, name) VALUES (?, ?)",
      );

      await expect(stmt.run(1, "test")).rejects.toThrow();

      const prepareCalls = listener.handlers.error.mock.calls.filter(
        (call) => call[0].method === "prepare.run",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].error).toBeDefined();
      expect(prepareCalls[0][0].query).toContain(
        "INSERT INTO non_existing_table",
      );
      expect(prepareCalls[0][0].method).toBe("prepare.run");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");
    });
  });

  describe("prepare.get", () => {
    it("should emit correct tracing events on success", async () => {
      const listener = createTracingListener("query");

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );

      const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
      const row = await stmt.get(1);

      expect(row).toBeDefined();
      expect((row as any).name).toBe("John Doe");

      // Find the prepare.get query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.get",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].query).toContain("SELECT * FROM users");
      expect(prepareCalls[0][0].method).toBe("prepare.get");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");

      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should emit error event on failure", async () => {
      const listener = createTracingListener("query");

      const stmt = db.prepare("SELECT * FROM non_existing_table WHERE id = ?");

      await expect(stmt.get(1)).rejects.toThrow();

      const prepareCalls = listener.handlers.error.mock.calls.filter(
        (call) => call[0].method === "prepare.get",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].error).toBeDefined();
      expect(prepareCalls[0][0].query).toContain(
        "SELECT * FROM non_existing_table",
      );
      expect(prepareCalls[0][0].method).toBe("prepare.get");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");
    });
  });

  describe("query reconstruction in sql method", () => {
    it("should correctly reconstruct query with template literals", async () => {
      const listener = createTracingListener("query");

      const name = "John Doe";
      const email = "john@example.com";
      await db.sql`SELECT * FROM users WHERE name = ${name} AND email = ${email}`;

      const selectCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "sql" && call[0].query.includes("SELECT"),
      );
      expect(selectCalls.length).toBeGreaterThan(0);

      // Query should be reconstructed with placeholders
      const query = selectCalls[0][0].query;
      expect(query).toBe("SELECT * FROM users WHERE name = ? AND email = ?");
      expect(selectCalls[0][0].dialect).toBe("sqlite");
    });
  });

  describe("multiple operations", () => {
    it("should emit separate events for each operation", async () => {
      const listener = createTracingListener("query");

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );
      await db.sql`SELECT * FROM users WHERE id = ${1}`;
      const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
      await stmt.all(1);

      // One event per public call: `sql` prepares internally but must not
      // emit an extra `prepare.all` on top of its own `sql` event.
      const methods = listener.handlers.start.mock.calls.map(
        (call) => call[0].method,
      );
      expect(methods).toEqual(["exec", "sql", "prepare.all"]);
    });
  });

  describe("nested bind support", () => {
    it("should support chained bind calls with all()", async () => {
      const listener = createTracingListener("query");

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );
      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (2, 'Jane Doe', 'jane@example.com')`,
      );

      const stmt = db.prepare("SELECT * FROM users WHERE id > ?");
      const boundStmt = stmt.bind(0);
      const rows = await boundStmt.all();

      expect(rows).toHaveLength(2);

      // Find the prepare.all query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.all",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].query).toContain("SELECT * FROM users");
      expect(prepareCalls[0][0].method).toBe("prepare.all");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");

      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should support chained bind calls with run()", async () => {
      const listener = createTracingListener("query");

      const stmt = db.prepare(
        "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
      );
      const boundStmt = stmt.bind(10, "Alice Smith", "alice@example.com");
      const result = await boundStmt.run();

      expect(result).toBeDefined();

      // Find the prepare.run query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.run",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].query).toContain("INSERT INTO users");
      expect(prepareCalls[0][0].method).toBe("prepare.run");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");

      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should support chained bind calls with get()", async () => {
      const listener = createTracingListener("query");

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );

      const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
      const boundStmt = stmt.bind(1);
      const row = await boundStmt.get();

      expect(row).toBeDefined();
      expect((row as any).name).toBe("John Doe");

      // Find the prepare.get query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.get",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].query).toContain("SELECT * FROM users");
      expect(prepareCalls[0][0].method).toBe("prepare.get");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");

      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should support multiple nested bind calls", async () => {
      const listener = createTracingListener("query");

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );

      const stmt = db.prepare(
        "SELECT * FROM users WHERE id = ? AND name = ? AND email = ?",
      );
      const row = await stmt.bind(1, "John Doe", "john@example.com").get();

      expect(row).toBeDefined();
      expect((row as any).name).toBe("John Doe");
      expect((row as any).email).toBe("john@example.com");

      // Find the prepare.get query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.get",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);
      expect(prepareCalls[0][0].query).toContain("SELECT * FROM users");
      expect(prepareCalls[0][0].method).toBe("prepare.get");
      expect(prepareCalls[0][0].dialect).toBe("sqlite");

      expect(listener.handlers.error).not.toHaveBeenCalled();
    });

    it("should preserve query context through nested binds", async () => {
      const listener = createTracingListener("query");

      const query = "SELECT * FROM users WHERE id = ?";
      const stmt = db.prepare(query);

      await db.exec(
        `INSERT INTO users (id, name, email) VALUES (1, 'John Doe', 'john@example.com')`,
      );

      // Bind in multiple steps - each rebind replaces the parameters
      const step1 = stmt.bind(999); // This will be replaced
      const step2 = step1.bind(1); // This is the final binding
      const row = await step2.get();

      expect(row).toBeDefined();
      expect((row as any).name).toBe("John Doe");

      // Find the prepare.get query event
      const prepareCalls = listener.handlers.start.mock.calls.filter(
        (call) => call[0].method === "prepare.get",
      );
      expect(prepareCalls.length).toBeGreaterThan(0);

      // The original query should be preserved through all bind operations
      expect(prepareCalls[0][0].query).toBe(query);
      expect(prepareCalls[0][0].dialect).toBe("sqlite");
    });
  });
});
