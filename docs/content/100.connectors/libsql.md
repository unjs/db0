---
navigation.title: LibSQL
---

# LibSQL Connector

Connect to [LibSQL](https://libsql.org/) database.

::alert{type="primary"}
🚀 This connector will be comming soon! Follow up via [unjs/db0#14](https://github.com/unjs/db0/issues/14).
::

```js
import { createDB, sql } from "db0";
import vercelPostgres from "db0/connectors/libsql";

const db = createDB(
  libsql({
    /* options */
  })
);
```
