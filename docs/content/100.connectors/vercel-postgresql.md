---
navigation.title: Vecel Postgresql
---

# PlanetScale Connector

Connect to [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) database.

::alert{type="primary"}
🚀 This connector will be comming soon! Follow up via [unjs/sql0#3](https://github.com/unjs/sql0/issues/3).
::

```js
import { createDB, sql } from "sql0";
import vercelPostgres from "sql0/connectors/vercel-postgres";

const db = createDB(
  vercelPostgres({
    /* options */
  })
);
```
