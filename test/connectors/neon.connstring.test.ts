import { describe, test, expect, vi } from "vitest";

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

import neonConnector from "../../src/connectors/neon";
import { createDatabase } from "../../src";
import * as neonNew from "neon-new";

describe("[Neon Connector] Connection string generation", () => {
  test("should call `neon-new` when connection string is not provided out of production environment", async () => {
    const db = createDatabase(neonConnector());
    await db.getInstance();
    expect(vi.mocked(neonNew.instantPostgres)).toHaveBeenCalledOnce();
  });
});
