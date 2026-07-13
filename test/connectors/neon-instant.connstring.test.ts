import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("neon-new", () => {
  return {
    instantPostgres: vi.fn().mockResolvedValue({
      databaseUrl: "postgres://mocked-host/db",
    }),
  };
});

vi.mock("@neondatabase/serverless", () => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn().mockResolvedValue(undefined),
  };

  class MockClient {
    connect() {
      return mockClient.connect();
    }
    query() {
      return mockClient.query();
    }
    end() {
      return mockClient.end();
    }
  }

  return {
    Client: MockClient,
  };
});

import neonInstantConnector from "../../src/connectors/neon-instant";
import neonConnector from "../../src/connectors/neon";
import { createDatabase } from "../../src";
import * as neonNew from "neon-new";

describe("[Neon Instant Connector] Connection string generation", () => {
  beforeEach(() => {
    vi.mocked(neonNew.instantPostgres).mockClear();
  });

  test("provisions a database when no connection string is provided", async () => {
    const db = createDatabase(neonInstantConnector());
    await db.getInstance();
    expect(vi.mocked(neonNew.instantPostgres)).toHaveBeenCalledOnce();
  });

  test("forwards provisioning options and defaults the referrer", async () => {
    const db = createDatabase(
      neonInstantConnector({ seed: { type: "sql-script", path: "init.sql" } }),
    );
    await db.getInstance();
    expect(vi.mocked(neonNew.instantPostgres)).toHaveBeenCalledWith(
      expect.objectContaining({
        referrer: "db0/neon-connector",
        seed: { type: "sql-script", path: "init.sql" },
      }),
    );
  });

  test("does not provision when a connection string is provided", async () => {
    const db = createDatabase(
      neonInstantConnector({ url: "postgres://user@host/db" }),
    );
    await db.getInstance();
    expect(vi.mocked(neonNew.instantPostgres)).not.toHaveBeenCalled();
  });
});

describe("[Neon Connector] SDK only", () => {
  beforeEach(() => {
    vi.mocked(neonNew.instantPostgres).mockClear();
  });

  test("never provisions and throws without a connection string", async () => {
    const db = createDatabase(neonConnector());
    await expect(db.getInstance()).rejects.toThrow(/Missing connection string/);
    expect(vi.mocked(neonNew.instantPostgres)).not.toHaveBeenCalled();
  });
});
