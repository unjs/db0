---
navigation.title: Vecel Postgresql
---

# PlanetScale Connector

Connect to [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) database.

::alert{type="primary"}
🚀 This connector will be comming soon! Follow up via [unjs/db0#3](https://github.com/unjs/db0/issues/3).
::

```js
import { createDatabase, sql } from "db0";
import vercelPostgres from "db0/connectors/vercel-postgres";

const db = createDatabase(
  vercelPostgres({
    /* options */
  }),
);
```
