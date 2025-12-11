import { createDatabase } from "../../src";
import { TraceContext, withTracing } from "../../src/tracing";
import { tracingChannel } from "node:diagnostics_channel";

import sqlite from "../../src/connectors/better-sqlite3";

async function main() {
  const db = withTracing(createDatabase(sqlite({})));

  // Subscribe to tracing events
  subscribeToTracing();

  await db.sql`create table if not exists users (
    id integer primary key autoincrement,
    full_name text
  )`;

  const res = await db.sql`insert into users (full_name) values ('John Doe')`;

  console.log({ res });
}

function subscribeToTracing() {
  const queryChannel = tracingChannel<TraceContext>("db0.query");

  queryChannel.subscribe({
    start: (data) => {
      console.log("start", data.query);
    },
    end: (message) => {
      console.log("end", message.query);
    },
    asyncStart: (data) => {
      console.log("asyncStart", data.query);
    },
    asyncEnd: (data) => {
      console.log("asyncEnd", data.query, data.result);
    },
    error: (data) => {
      console.log("error", data.error);
    },
  });
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  console.error(error);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
});
