
import { createDatabase } from "../../src";
import neonConnector from "../../src/connectors/neon"
import dotenv from 'dotenv'

dotenv.config({
  path: '../../.env'
})

async function main() {
  const db = createDatabase(neonConnector({
    url: process.env.POSTGRESQL_URL!,
  }));

  // create posts table if it doesn't exist
  await db.sql`create table if not exists posts (
    id serial primary key,
    title text,
    content text
  )`;

  // insert a new post
  const currentDate = new Date().toISOString();
  await db.exec(`insert into posts (title, content) values ('Hello, world!', 'This post was created at ${currentDate}')`);

  // select the first post
  const firstPost = await db.prepare(`SELECT * FROM posts ORDER BY id ASC LIMIT 1`).get();
  console.log('first Post:', firstPost.title);

  // select all posts
  const res = await db.prepare(`SELECT * FROM posts`).all();
  console.log('total Posts:', res.length);

}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  console.error(error);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
});
