import { sqliteTable, text, numeric } from "drizzle-orm/sqlite-core";

import { createDatabase } from "../../src";
import { drizzle } from "../../src/integrations/drizzle"

import sqlite from "../../src/connectors/better-sqlite3";

export const users = sqliteTable("users", {
  id: numeric("id"),
  name: text("full_name"),
});

const schema = { users };

async function main() {
  const db0 = createDatabase(sqlite({}));
  const db = drizzle(db0, { schema });

  await db0.sql`create table if not exists users (
    id integer primary key autoincrement,
    full_name text
  )`;

  await db0.sql`insert into users (full_name) values ('John Doe')`;

  const res = await db.select().from(users).all();
  console.log({ res });
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  console.error(error);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
});
