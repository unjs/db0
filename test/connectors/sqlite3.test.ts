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

    // Sqlite3 Connection solves this by forwarding the error to final callback
    await expect(db.prepare("SELECT * FROM table_1").all()).rejects.toThrowError()

    // [sqlite3 behavior for reference]
    // const instance = await db.getInstance();
    // const result = await new Promise((resolve) => {
    //   const calls = [] as string[]
    //   instance.prepare("SELECT * FROM table_1", () => {
    //     calls.push('prepare callback')
    //     setImmediate(() => { resolve(calls) })
    //   }).all(() => {
    //     calls.push('all callback')
    //     setImmediate(() => { resolve(calls) })
    //   })
    // })
    // // Only prepare callback is called because the table doesn't exist
    // expect(result).toStrictEqual(['prepare callback'])
  })
});
