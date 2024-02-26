---
icon: simple-icons:drizzle
---

# Drizzle

> Integrate DB0 with Drizzle ORM

:read-more{to="https://orm.drizzle.team"}

## Example

```ts [index.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { drizzle } from "db0/integrations/drizzle";
import { sqliteTable, text, numeric } from "drizzle-orm/sqlite-core";

// Initialize DB instance
// You can use any other available connector
const db = createDatabase(sqlite({}));

// Use simple db0 API to make queries
await db.sql`create table if not exists users (
    id integer primary key autoincrement,
    full_name text
  )`;
await db.sql`insert into users (full_name) values ('John Doe')`;

// And then leverage drizzle typed API to make more advanced ones
const drizzleDb = drizzle(db);
await drizzleDb.select().from(users).all();
```
