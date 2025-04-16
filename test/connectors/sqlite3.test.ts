import { describe, test, expect } from "vitest";
import connector from "../../src/connectors/sqlite3";
import { testConnector } from "./_tests";

describe("connectors: sqlite3", () => {
  testConnector({
    dialect: "sqlite",
    connector: connector({
      name: ":memory:",
    }),
  });

  test('Sqlite3 prepare callback', async () => {
    const db = connector({
      name: ":memory:",
    })

    // Node Sqlite3 only calls prepare callback on error
    const instance = await db.getInstance();
    const result = await new Promise((resolve) => {
      const calls = [] as string[]
      instance.prepare("SELECT * FROM table_1", () => {
        calls.push('prepare callback')
        setTimeout(() => {
          resolve(calls)
        }, 1000)
      }).all(() => {
        calls.push('all callback')
        setTimeout(() => {
          resolve(calls)
        }, 1000)
      })
    })
    // Only prepare callback is called because the table doesn't exist
    expect(result).toStrictEqual(['prepare callback'])

    // Sqlite3 Connection solves this by forwarding the error to final callback
    const res = await db.prepare("SELECT * FROM table_1").all().catch(() => "REJECTED");
    expect(res).toBe("REJECTED");
  })
});
