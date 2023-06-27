import { createDatabase } from "../../../src";
import sqlite from "../../../src/connectors/better-sqlite3";
import { drizzle } from "./driver";
import { sqliteTable, text, numeric } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: numeric("id"),
  name: text("full_name"),
});

async function main() {
  const db = createDatabase(sqlite({}));
  const drizzleDb = drizzle(db);

  await db.sql`create table if not exists users (
    id integer primary key autoincrement,
    full_name text
  )`;

  await db.sql`insert into users (full_name) values ('John Doe')`;

  const res = await drizzleDb.select().from(users).all();
  console.log({ res });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
