import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../src/database";
import betterSqlite3Connector from "../src/connectors/better-sqlite3";
import type { Database } from "../src/types";

describe("Database Disposal", () => {
  let db: Database;

  beforeEach(() => {
    // Create a fresh database instance for each test
    const connector = betterSqlite3Connector({ name: ":memory:" });
    db = createDatabase(connector);
  });

  describe("disposal state tracking", () => {
    it("should start with disposed = false", () => {
      expect(db.disposed).toBe(false);
    });

    it("should set disposed = true after close()", async () => {
      expect(db.disposed).toBe(false);
      await db.close();
      expect(db.disposed).toBe(true);
    });

    it("should set disposed = true after Symbol.asyncDispose", async () => {
      expect(db.disposed).toBe(false);
      await db[Symbol.asyncDispose]();
      expect(db.disposed).toBe(true);
    });
  });

  describe("operations before disposal", () => {
    it("should allow all operations when not disposed", async () => {
      // Test exec
      await expect(
        db.exec("CREATE TABLE test (id INTEGER)"),
      ).resolves.toBeDefined();

      // Test prepare
      expect(() => db.prepare("SELECT 1")).not.toThrow();

      // Test sql template
      await expect(db.sql`SELECT 1`).resolves.toBeDefined();

      // Test getInstance
      expect(await db.getInstance()).toBeDefined();
    });
  });

  describe("operations after disposal", () => {
    beforeEach(async () => {
      // Set up a table before disposal
      await db.exec("CREATE TABLE test (id INTEGER)");
      await db.close(); // Dispose the database
    });

    it("should reject exec() after disposal", () => {
      expect(() => db.exec("SELECT 1")).toThrow(
        "Database instance has been disposed and cannot be used",
      );
    });

    it("should reject prepare() after disposal", () => {
      expect(() => db.prepare("SELECT 1")).toThrow(
        "Database instance has been disposed and cannot be used",
      );
    });

    it("should reject sql template after disposal", async () => {
      await expect(db.sql`SELECT 1`).rejects.toThrow(
        "Database instance has been disposed and cannot be used",
      );
    });

    it("should reject getInstance() after disposal", () => {
      expect(() => db.getInstance()).toThrow(
        "Database instance has been disposed and cannot be used",
      );
    });
  });

  describe("close() and dispose() behavior", () => {
    it("should allow multiple calls to close()", async () => {
      // First close
      await expect(db.close()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);

      // Second close should not throw
      await expect(db.close()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);

      // Third close should not throw
      await expect(db.close()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);
    });

    it("should allow multiple calls to Symbol.asyncDispose", async () => {
      // First dispose
      await expect(db[Symbol.asyncDispose]()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);

      // Second dispose should not throw
      await expect(db[Symbol.asyncDispose]()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);

      // Third dispose should not throw
      await expect(db[Symbol.asyncDispose]()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);
    });

    it("should allow close() after Symbol.asyncDispose", async () => {
      await db[Symbol.asyncDispose]();
      expect(db.disposed).toBe(true);

      // close() should still work
      await expect(db.close()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);
    });

    it("should allow Symbol.asyncDispose after close()", async () => {
      await db.close();
      expect(db.disposed).toBe(true);

      // Symbol.asyncDispose should still work
      await expect(db[Symbol.asyncDispose]()).resolves.toBeUndefined();
      expect(db.disposed).toBe(true);
    });
  });

  describe("using syntax support", () => {
    it("should work with using syntax (Symbol.asyncDispose)", async () => {
      const connector = betterSqlite3Connector({ name: ":memory:" });

      // Simulate using syntax behavior
      {
        const db = createDatabase(connector);
        await db.exec("CREATE TABLE test (id INTEGER)");
        expect(db.disposed).toBe(false);

        // This simulates what happens at the end of a using block
        await db[Symbol.asyncDispose]();
        expect(db.disposed).toBe(true);

        // Operations should fail after disposal
        expect(() => db.exec("SELECT 1")).toThrow(
          "Database instance has been disposed and cannot be used",
        );
      }
    });
  });

  describe("connector close() method behavior", () => {
    it("should dispose when connector has close() method", async () => {
      // Use default betterSqlite3 connector which has close()
      const connector = betterSqlite3Connector({ name: ":memory:" });
      const db = createDatabase(connector);

      expect(db.disposed).toBe(false);
      expect(typeof connector.close).toBe("function");

      await db.close();
      expect(db.disposed).toBe(true);

      // Operations should fail after disposal
      expect(() => db.exec("SELECT 1")).toThrow(
        "Database instance has been disposed and cannot be used",
      );
    });

    it("should not dispose when connector lacks close() method", async () => {
      const connector = betterSqlite3Connector({ name: ":memory:" });
      delete connector.close;
      const db = createDatabase(connector);

      expect(db.disposed).toBe(false);
      expect(connector.close).toBeUndefined();

      await db.close();
      expect(db.disposed).toBe(false);

      // Operations should still work
      await expect(db.exec("SELECT 1")).resolves.toBeDefined();
    });
  });

  describe("error scenarios", () => {
    it("should handle disposal when connector.close() throws", async () => {
      // Create a connector that throws on close
      const connector = betterSqlite3Connector({ name: ":memory:" });
      const originalClose = connector.close;
      connector.close = () => {
        throw new Error("Close failed");
      };

      const db = createDatabase(connector);

      // close() should still mark as disposed even if connector.close() throws
      await expect(db.close()).rejects.toThrow("Close failed");
      expect(db.disposed).toBe(true);

      // Operations should still be rejected
      expect(() => db.exec("SELECT 1")).toThrow(
        "Database instance has been disposed and cannot be used",
      );

      // Restore original close to prevent issues in cleanup
      connector.close = originalClose;
    });

    it("should handle disposal when connector.close() is undefined", async () => {
      const connector = betterSqlite3Connector({ name: ":memory:" });
      delete connector.close;

      const db = createDatabase(connector);

      // Should not throw when connector.close is undefined
      await expect(db.close()).resolves.toBeUndefined();
      // Database should NOT be disposed if connector doesn't have close()
      expect(db.disposed).toBe(false);

      // Operations should still work since database is not disposed
      await expect(db.exec("SELECT 1")).resolves.toBeDefined();
    });

    it("should handle Symbol.asyncDispose when connector.close() is undefined", async () => {
      const connector = betterSqlite3Connector({ name: ":memory:" });
      delete connector.close;

      const db = createDatabase(connector);

      // Should not throw when connector.close is undefined
      await expect(db[Symbol.asyncDispose]()).resolves.toBeUndefined();
      // Database should NOT be disposed if connector doesn't have close()
      expect(db.disposed).toBe(false);

      // Operations should still work since database is not disposed
      await expect(db.exec("SELECT 1")).resolves.toBeDefined();
    });
  });

  describe("complex scenarios", () => {
    it("should handle prepared statements after disposal", async () => {
      // Create and prepare a statement before disposal
      await db.exec("CREATE TABLE test (id INTEGER, name TEXT)");
      const stmt = db.prepare("INSERT INTO test (id, name) VALUES (?, ?)");

      // Dispose the database
      await db.close();

      // The statement should still exist but operations should fail
      // Note: This tests the current behavior - prepared statements created before disposal
      // may still exist but their operations should fail if they check the database state
      expect(stmt).toBeDefined();
    });

    it("should maintain disposal state across different operation types", async () => {
      // Set up some data
      await db.exec("CREATE TABLE test (id INTEGER)");
      await db.sql`INSERT INTO test (id) VALUES (${1})`;

      // Verify operations work
      const result = await db.sql`SELECT * FROM test`;
      expect(result.rows).toHaveLength(1);

      // Dispose
      await db.close();
      expect(db.disposed).toBe(true);

      // All operations should fail
      expect(() => db.exec("SELECT 1")).toThrow(
        "Database instance has been disposed and cannot be used",
      );
      expect(() => db.prepare("SELECT 1")).toThrow(
        "Database instance has been disposed and cannot be used",
      );
      await expect(db.sql`SELECT 1`).rejects.toThrow(
        "Database instance has been disposed and cannot be used",
      );
      expect(() => db.getInstance()).toThrow(
        "Database instance has been disposed and cannot be used",
      );
    });
  });
});
