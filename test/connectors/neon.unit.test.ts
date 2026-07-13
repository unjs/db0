import { describe, test, expect, vi, beforeEach } from "vitest";

const { instantPostgres, clients, state, MockClient } = vi.hoisted(() => {
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

  return { instantPostgres: vi.fn(), clients, state, MockClient };
});

vi.mock("neon-new", () => ({ instantPostgres }));
vi.mock("@neondatabase/serverless", () => ({ Client: MockClient }));

import neonConnector from "../../src/connectors/neon";
import neonInstantConnector from "../../src/connectors/neon-instant";
import { normalizeParams } from "../../src/connectors/_internal/neon";
import { createDatabase } from "../../src";

beforeEach(() => {
  clients.length = 0;
  state.connect = () => Promise.resolve();
  instantPostgres.mockReset();
  instantPostgres.mockResolvedValue({
    databaseUrl: "postgres://provisioned/db",
  });
  // The connector reuses an already-provisioned database from the environment.
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("NODE_ENV", "test");
});

describe("connectors: neon (sdk only)", () => {
  test("connects with the given connection string and never provisions", async () => {
    const db = createDatabase(
      neonConnector({ url: "postgres://user@host/db" }),
    );
    await db.getInstance();

    expect(clients[0].config.connectionString).toBe("postgres://user@host/db");
    expect(instantPostgres).not.toHaveBeenCalled();
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
    expect(instantPostgres).not.toHaveBeenCalled();
  });
});

describe("connectors: neon-instant", () => {
  test("provisions a database when nothing else identifies one", async () => {
    const db = createDatabase(neonInstantConnector());
    await db.getInstance();

    expect(instantPostgres).toHaveBeenCalledOnce();
    expect(clients[0].config.connectionString).toBe(
      "postgres://provisioned/db",
    );
  });

  test("forwards provisioning options and defaults the referrer", async () => {
    const seed = { type: "sql-script", path: "init.sql" } as const;
    const db = createDatabase(neonInstantConnector({ seed }));
    await db.getInstance();

    expect(instantPostgres).toHaveBeenCalledWith(
      expect.objectContaining({ referrer: "db0/neon-connector", seed }),
    );
  });

  test("keeps provisioning options out of the client config", async () => {
    const db = createDatabase(
      neonInstantConnector({
        seed: { type: "sql-script", path: "init.sql" },
        dotEnvFile: ".env.local",
      }),
    );
    await db.getInstance();

    expect(clients[0].config).not.toHaveProperty("seed");
    expect(clients[0].config).not.toHaveProperty("dotEnvFile");
    expect(clients[0].config).not.toHaveProperty("referrer");
  });

  test("reuses an already-provisioned database from the environment", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://existing/db");

    const db = createDatabase(neonInstantConnector());
    await db.getInstance();

    expect(instantPostgres).not.toHaveBeenCalled();
    expect(clients[0].config.connectionString).toBe("postgres://existing/db");
  });

  test("prefers an explicit connection string over provisioning", async () => {
    const db = createDatabase(
      neonInstantConnector({ url: "postgres://user@host/db" }),
    );
    await db.getInstance();

    expect(instantPostgres).not.toHaveBeenCalled();
  });

  test("refuses to provision in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const db = createDatabase(neonInstantConnector());
    await expect(db.getInstance()).rejects.toThrow(/production/);
    expect(instantPostgres).not.toHaveBeenCalled();
  });
});

describe("connectors: neon client lifecycle", () => {
  test("concurrent first queries share one client and provision once", async () => {
    const db = createDatabase(neonInstantConnector());

    await Promise.all([db.sql`SELECT 1`, db.sql`SELECT 2`, db.sql`SELECT 3`]);

    expect(instantPostgres).toHaveBeenCalledOnce();
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

describe("neon: normalizeParams", () => {
  test("rewrites placeholders into $n", () => {
    expect(normalizeParams("SELECT * FROM t WHERE a = ? AND b = ?")).toBe(
      "SELECT * FROM t WHERE a = $1 AND b = $2",
    );
  });

  test("leaves `?` inside string literals alone", () => {
    expect(normalizeParams("SELECT ? WHERE note = 'why?'")).toBe(
      "SELECT $1 WHERE note = 'why?'",
    );
  });

  test("leaves jsonb operators alone", () => {
    expect(normalizeParams("SELECT * FROM t WHERE data ?| ? AND d ?& ?")).toBe(
      "SELECT * FROM t WHERE data ?| $1 AND d ?& $2",
    );
  });

  test("leaves `?` inside comments alone", () => {
    expect(normalizeParams("SELECT ? -- why?\nFROM t")).toBe(
      "SELECT $1 -- why?\nFROM t",
    );
  });
});
