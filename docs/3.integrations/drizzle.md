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

## Example with Nuxt 3 and Nitro

> [!IMPORTANT]
> Database support is currently experimental.
> Refer to the [db0 issues](https://github.com/unjs/db0/issues) for status and bug report.

```ts [server/utils/db.ts]
// ./server/utils/db.ts
import { drizzle } from "db0/integrations/drizzle";
export const db = useDatabase(); 
export const orm = drizzle(useDatabase()); 

db.sql`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  email TEXT,
  role TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;
```

```ts [server/api/index.ts]
// ./server/api/index.ts
export default defineEventHandler(async () => {
  try {
    const users = await orm.select().from(users).all();
    return { ...users }
  } catch (e: any) {
    throw createError({
      statusCode: 400,
      statusMessage: e.message,
    });
  }
});
```

## References

- [Nuxt 3 Nightly Example Repo](https://github.com/justserdar/jsd-nuxt-turso-drizzle/tree/nightly)
