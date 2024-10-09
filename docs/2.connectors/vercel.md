---
icon: radix-icons:vercel-logo
---

# Vercel

> Connect DB0 to Vercel Postgres

:read-more{to="https://vercel.com/docs/storage/vercel-postgres"}

::read-more{to="https://github.com/unjs/db0/issues/32"}
A dedicated `vercel` connector is planned to be supported. Follow up via [unjs/db0#32](https://github.com/unjs/db0/issues/32).
::

## Usage

Use [`postgres`](/connectors/postgresql) connector:

```js
import { createDatabase } from "db0";
import postgres from "db0/connectors/postgres";

const db = createDatabase(
  postgres({
    /* options */
  }),
);
```
