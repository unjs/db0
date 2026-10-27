import { describe, expect, test } from "bun:test";
import { tracingChannel } from "node:diagnostics_channel";

import connector from "../../src/connectors/bun-sqlite";
import { createDatabase } from "../../src";
import { withTracing, QUERY_CHANNEL } from "../../src/tracing";

test("connectors: bun", async () => {
  const db = createDatabase(connector({ name: ":memory:" }));

  const userId = "1001";

  await db.sql`DROP TABLE IF EXISTS users`;
  await db.sql`CREATE TABLE users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
  expect(rows).toMatchObject([
    { id: userId, firstName: "John", lastName: "Doe", email: "" },
  ]);
});

test("tracing: bun", async () => {
  const db = withTracing(createDatabase(connector({ name: ":memory:" })));

  const queries: string[] = [];
  const channel = tracingChannel(QUERY_CHANNEL);
  const handlers = {
    start: (message: any) => queries.push(message.query),
    end() {},
    asyncStart() {},
    asyncEnd() {},
    error() {},
  };
  channel.subscribe(handlers);
  try {
    await db.exec("SELECT 1");
  } finally {
    channel.unsubscribe(handlers);
  }

  expect(queries).toEqual(["SELECT 1"]);
});
