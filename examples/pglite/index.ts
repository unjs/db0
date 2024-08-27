import { createDatabase } from "../../src";
import pglite from "../../src/connectors/pglite";



async function main() {
  const db = createDatabase(pglite({
    dataDir: ".data/pglite-data"
  }));

  await db.sql`create table if not exists users (
    id serial primary key,
    full_name text
  )`;

  await db.sql`insert into users (full_name) values ('John Doe')`;

  const res = (await db.sql`select * from users`).rows
  console.log({ res });
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  console.error(error);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
});
