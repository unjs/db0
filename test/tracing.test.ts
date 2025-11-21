import { describe, it, expect, beforeEach, vi } from "vitest";
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

  return {
    events,
    handlers: {
      start: startHandler,
      end: endHandler,
      asyncStart: asyncStartHandler,
      asyncEnd: asyncEndHandler,
      error: errorHandler,
    },
    cleanup: () => {
      channel.unsubscribe({
        start: startHandler,
        end: endHandler,
        asyncStart: asyncStartHandler,
        asyncEnd: asyncEndHandler,
        error: errorHandler,
      });
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

      listener.cleanup();
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

      listener.cleanup();
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
      expect(listener.events.start?.data.dialect).toBe("sqlite");

      listener.cleanup();
    });

    it("should emit error event on failure", async () => {
      const listener = createTracingListener("query");

      await expect(
        db.exec(`INSERT INTO non_existing_table VALUES (1, 'test')`),
      ).rejects.toThrow();

      expect(listener.handlers.start).toHaveBeenCalledTimes(1);
      // asyncStart might not be called if error is thrown synchronously
      expect(listener.handlers.asyncStart).not.toHaveBeenCalledTimes(1);
      expect(listener.handlers.error).toHaveBeenCalledTimes(1);
      expect(listener.events.error?.error).toBeDefined();
      expect(listener.events.error?.data.query).toContain(
        "INSERT INTO non_existing_table",
      );
      expect(listener.events.error?.data.method).toBe("exec");
      expect(listener.events.error?.data.dialect).toBe("sqlite");

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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

      listener.cleanup();
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
      expect(query).toContain("SELECT * FROM users");
      expect(query).toContain("WHERE");
      expect(query).toContain("name");
      expect(query).toContain("email");
      expect(selectCalls[0][0].dialect).toBe("sqlite");

      listener.cleanup();
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

      // Should have events for: exec, sql (prepare.all internally), and prepare.all
      expect(listener.handlers.start.mock.calls.length).toBeGreaterThanOrEqual(
        3,
      );

      // Check that different methods were called
      const methods = listener.handlers.start.mock.calls.map(
        (call) => call[0].method,
      );
      expect(methods).toContain("exec");
      expect(methods).toContain("sql");
      expect(methods).toContain("prepare.all");

      listener.cleanup();
    });
  });
});
