---
icon: radix-icons:vercel-logo
---

# Vercel

Connect to [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) database.

:read-more{to="https://vercel.com/docs/storage/vercel-postgres"}

> [!WARNING]
> 🚀 This connector will be supported soon! Follow up via [unjs/db0#3](https://github.com/unjs/db0/issues/3). In the meantime you can directly use [PostgreSQL connector](/connectors/postgresql).

## Usage

Use [`postgress`](/connectors/postgresql) connector.

```js
import { createDatabase, sql } from "db0";
import postgres from "db0/connectors/postgres";

const db = createDatabase(
  postgres({
    /* options */
  }),
);
```
