import { describe, test, expect, vi, beforeEach } from "vitest";

const { clients, state, MockClient } = vi.hoisted(() => {
  const clients: any[] = [];
  const state = { connect: () => Promise.resolve() };

  class MockClient {
    config: any;
    connects = 0;
    ends = 0;
    queries: { sql: string; params?: unknown[] }[] = [];

    constructor(config: any) {
      this.config = config;
      clients.push(this);
    }

    connect() {
      this.connects++;
      return state.connect();
    }

    query(sql: string, params?: unknown[]) {
      this.queries.push({ sql, params });
      return Promise.resolve({ rows: [], rowCount: 0 });
    }

    end() {
      this.ends++;
      return Promise.resolve();
    }
  }

  return { clients, state, MockClient };
});

vi.mock("@neondatabase/serverless", () => ({ Client: MockClient }));

import neonConnector from "../../src/connectors/neon";
import { createDatabase } from "../../src";

beforeEach(() => {
  clients.length = 0;
  state.connect = () => Promise.resolve();
});

describe("connectors: neon", () => {
  test("connects with the given connection string", async () => {
    const db = createDatabase(
      neonConnector({ url: "postgres://user@host/db" }),
    );
    await db.getInstance();

    expect(clients[0].config.connectionString).toBe("postgres://user@host/db");
  });

  test("accepts a ClientConfig without a connection string", async () => {
    const db = createDatabase(
      neonConnector({ host: "localhost", user: "u", database: "d" }),
    );
    await db.getInstance();

    expect(clients[0].config).toMatchObject({ host: "localhost", user: "u" });
  });

  test("throws when no connection string is available", async () => {
    const db = createDatabase(neonConnector());
    await expect(db.getInstance()).rejects.toThrow(/Missing connection string/);
  });
});

describe("connectors: neon client lifecycle", () => {
  test("concurrent first queries share one client", async () => {
    const db = createDatabase(
      neonConnector({ url: "postgres://user@host/db" }),
    );

    await Promise.all([db.sql`SELECT 1`, db.sql`SELECT 2`, db.sql`SELECT 3`]);

    expect(clients).toHaveLength(1);
    expect(clients[0].connects).toBe(1);
  });

  test("disposing closes the client", async () => {
    const db = createDatabase(
      neonConnector({ url: "postgres://user@host/db" }),
    );
    await db.getInstance();
    await db.dispose();

    expect(clients[0].ends).toBe(1);
  });

  test("a failed connect is retried rather than cached", async () => {
    state.connect = () => Promise.reject(new Error("boom"));

    const connector = neonConnector({ url: "postgres://user@host/db" });
    await expect(connector.getInstance()).rejects.toThrow("boom");

    // A later attempt reconnects rather than replaying the cached failure.
    state.connect = () => Promise.resolve();
    await expect(connector.getInstance()).resolves.toBeInstanceOf(MockClient);
    expect(clients).toHaveLength(2);
  });

  test("disposing after a failed connect does not re-throw", async () => {
    state.connect = () => Promise.reject(new Error("boom"));

    const db = createDatabase(
      neonConnector({ url: "postgres://user@host/db" }),
    );
    await expect(db.getInstance()).rejects.toThrow("boom");
    await expect(db.dispose()).resolves.toBeUndefined();
  });
});
