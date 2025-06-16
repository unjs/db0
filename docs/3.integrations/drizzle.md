---
icon: simple-icons:drizzle
---

# Drizzle

> Integrate DB0 with Drizzle ORM

:read-more{to="https://orm.drizzle.team"}

## Example

Define your database schema using Drizzle's schema system:

```ts [schema.ts]
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

Initialize your database with Drizzle integration:

```ts [database.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { drizzle } from "db0/integrations/drizzle";
import * as schema from "./schema";

// Initialize DB instance with SQLite connector
const db0 = createDatabase(sqlite({ name: 'database.sqlite' }));

// Create Drizzle instance with schema
export const db = drizzle(db0, { schema });
```

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
  fullName: 'John Doe',
  email: 'john@example.com',
  createdAt: new Date()
};

const insertedUser = await db.insert(users).values(newUser).returning().get()

// Query users with full type safety
const allUsers = await db.select().from(users);

// Query with conditions
const johnDoe = await db.select()
  .from(users)
  .where(eq(users.email, 'john@example.com'));
```

## Configuration

Create a `drizzle.config.ts` file for migration management:

```ts [drizzle.config.ts]
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './database.sqlite'
  }
});
```

This approach provides:
- ✅ Full TypeScript type safety
- ✅ Automatic schema migrations  
- ✅ No raw SQL required
- ✅ Consistent drizzle patterns throughout