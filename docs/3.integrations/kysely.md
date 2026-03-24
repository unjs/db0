---
icon: mynaui:letter-k
---

# Kysely

> Integrate DB0 with Kysely query builder

:read-more{to="https://kysely.dev"}

## Usage

Install `kysely` dependency:

```bash
npx nypm add kysely
```

Create a db0 database and wrap it with Kysely:

```ts [database.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { kysely } from "db0/integrations/kysely";

// Define your database types
interface UsersTable {
  id: number;
  name: string;
  email: string;
}

interface Database {
  users: UsersTable;
}

// Initialize DB instance
const db = createDatabase(sqlite({ name: "database.sqlite" }));

// Create Kysely instance (dialect is auto-detected from db0)
export const ky = kysely<Database>(db);
```

Then use Kysely's type-safe query builder:

```ts [queries.ts]
import { ky } from "./database";

// Insert a new user
const insertedUser = await ky
  .insertInto("users")
  .values({ name: "John Doe", email: "john@example.com" })
  .returning(["id", "name", "email"])
  .executeTakeFirst();

// Select all users
const allUsers = await ky.selectFrom("users").selectAll().execute();

// Query with conditions
const john = await ky
  .selectFrom("users")
  .selectAll()
  .where("email", "=", "john@example.com")
  .executeTakeFirst();

// Update
await ky
  .updateTable("users")
  .set({ name: "Jane Doe" })
  .where("id", "=", 1)
  .execute();

// Delete
await ky.deleteFrom("users").where("id", "=", 1).execute();
```

## Transactions

Kysely's transaction API works out of the box:

```ts
await ky.transaction().execute(async (trx) => {
  await trx.insertInto("users").values({ name: "Alice", email: "alice@example.com" }).execute();
  await trx.insertInto("users").values({ name: "Bob", email: "bob@example.com" }).execute();
});
```

## Dialect Detection

The integration automatically selects the correct Kysely dialect based on the db0 connector:

| db0 dialect    | Kysely dialect |
| -------------- | -------------- |
| `sqlite`       | SQLite         |
| `libsql`       | SQLite         |
| `postgresql`   | PostgreSQL     |
| `mysql`        | MySQL          |

This means you can switch connectors without changing your Kysely code.
