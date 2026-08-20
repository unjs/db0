---
icon: simple-icons:prisma
---

# Prisma

> Integrate DB0 with Prisma ORM

:read-more{to="https://www.prisma.io"}

DB0 integrates with Prisma as a [driver adapter](https://www.prisma.io/docs/orm/overview/databases/database-drivers#driver-adapters), so any DB0 connector can back a Prisma Client.

Supported providers: `sqlite` (including `libsql`), `postgresql` and `mysql`.

## Usage

Install `prisma` and `@prisma/client` dependencies:

:pm-install{name="prisma @prisma/client"}

Generate a Prisma Client from your schema. The `datasource` provider has to match the DB0 connector you use — a client generated for `sqlite` emits SQLite SQL and Prisma refuses to pair it with a Postgres adapter:

```prisma [schema.prisma]
datasource db {
  provider = "sqlite"
}

generator client {
  provider = "prisma-client"
  output   = "./generated"
}

model User {
  id   Int    @id @default(autoincrement())
  name String

  @@map("users")
}
```

Create a DB0 database and pass the adapter to Prisma Client:

```ts [database.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { prisma } from "db0/integrations/prisma";
import { PrismaClient } from "./generated/client";

// Initialize DB instance with SQLite connector
const db = createDatabase(sqlite({ name: "database.sqlite" }));

// Create Prisma Client with the DB0 adapter
export const prismaClient = new PrismaClient({ adapter: prisma(db) });
```

::note
Prisma migrations are not run through DB0. Use `prisma migrate` against your database directly, or create the schema with `db.sql` yourself.
::

::warning
`prismaClient.$disconnect()` disposes the underlying DB0 database, so avoid sharing one `db` instance between Prisma and other consumers unless you manage its lifetime together.
::

## Transactions

Prisma transactions (`$transaction`) are supported on connectors that keep a session open — see [capabilities](/guide/capabilities). Connectors that open a new connection per query (Cloudflare D1, PlanetScale, libsql over HTTP) report `transactions: false` and throw when a transaction is started.

Because a DB0 database wraps a single connection, transactions are serialized: a second transaction waits for the first to commit or roll back.
