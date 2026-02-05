---
icon: simple-icons:prisma
---

# Prisma

> Integrate DB0 with Prisma ORM

:read-more{to="https://www.prisma.io"}

## Example

Initialize your database with Prisma integration:

```ts [database.ts]
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { prisma } from "db0/integrations/prisma";
import * as schema from "./schema";

// Initialize DB instance with SQLite connector
const db0 = createDatabase(sqlite({ name: 'database.sqlite' }));

// Create Prisma Client with DB0 adapter
const adapter = prisma(db0);
export const prisma = new PrismaClient({ adapter });
```
