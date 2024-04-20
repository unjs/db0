import { createDatabase } from "../../src";
import mysqlConnector from "../../src/connectors/mysql2"


async function main() {
  const db = createDatabase(mysqlConnector({
    host: "localhost",
    user: "root",
    password: "root",
    database: "db0",
  }));

  await db.sql`CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL
  )`;

  await db.sql`INSERT INTO users (name) VALUES (${randomValue()})`;

  const users = await db.sql`SELECT * FROM users`;

  console.log({ rows: users.rows });
}

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  console.error(error);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
});

function randomValue() {
  return Math.random().toString(36).slice(7);
}
