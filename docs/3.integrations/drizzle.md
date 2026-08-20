---
icon: simple-icons:drizzle
---

# Drizzle

> Integrate DB0 with Drizzle ORM

:read-more{to="https://orm.drizzle.team"}

## Usage

Install `drizzle-orm` dependency:

:pm-install{name="drizzle-orm@rc"}

::note
db0 targets Drizzle **v1**, which is currently published under the `rc` tag.
See [Drizzle's v0 to v1 changes](https://orm.drizzle.team/docs/v0-v1-changes) for
the breaking changes — most notably relations are now declared with
`defineRelations()` and passed as `relations`, and per-column casing moved from
the `casing` option to the `snakeCase.table()` / `camelCase.table()` helpers.
::

## Example

Define your database schema using Drizzle's schema system:

```ts [schema.ts]
import { defineRelations } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
});

// Relations power the relational query builder (`db.query.*`)
export const relations = defineRelations({ users });

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Initialize your database with Drizzle integration:

```ts [database.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { drizzle } from "db0/integrations/drizzle";
import { relations } from "./schema";

// Initialize DB instance with SQLite connector
const db0 = createDatabase(sqlite({ name: "database.sqlite" }));

// Create Drizzle instance with relations
export const db = drizzle(db0, { relations });
```

::note
Passing `relations` is optional — it is only needed for the relational query
builder (`db.query.users.findMany(...)`). `drizzle(db0)` is enough for
`select()`, `insert()`, `update()` and `delete()`.
::

Use Drizzle's migration system to create tables:

```bash
# Generate migration from schema
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Or push schema directly (development)
npx drizzle-kit push
```

Then use fully typed queries:

```ts [queries.ts]
import { db, users, type NewUser } from "./database";

// Insert a new user with type safety
const newUser: NewUser = {
  fullName: "John Doe",
  email: "john@example.com",
  createdAt: new Date(),
};

const insertedUser = await db.insert(users).values(newUser).returning().get();

// Query users with full type safety
const allUsers = await db.select().from(users);

// Query with conditions
const johnDoe = await db
  .select()
  .from(users)
  .where(eq(users.email, "john@example.com"));

// Relational queries, using the `relations` passed above
const usersWithRelations = await db.query.users.findMany();
```

## Caveats

db0 connectors return rows as objects keyed by column name, so two selected
columns that come back under the same key (for example `id` from both sides of a
join) cannot be told apart. db0 raises an error instead of returning a wrong
value; select such columns with unique aliases, or use the relational query
builder, which always emits unique aliases:

```ts
const rows = await db
  .select({
    userId: sql<number>`${users.id}`.as("user_id"),
    postId: sql<number>`${posts.id}`.as("post_id"),
  })
  .from(users)
  .leftJoin(posts, eq(posts.userId, users.id));
```

## Configuration

Create a `drizzle.config.ts` file for migration management:

```ts [drizzle.config.ts]
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./database.sqlite",
  },
});
```
