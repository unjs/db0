---
navigation.title: LibSQL
---

# LibSQL Connector

Connect to [LibSQL](https://libsql.org/) database.

::alert{type="primary"}
🚀 This connector will be comming soon! Follow up via [unjs/sql0#14](https://github.com/unjs/sql0/issues/14).
::

```js
import { createDB, sql } from "sql0";
import vercelPostgres from "sql0/connectors/libsql";

const db = createDB(
  libsql({
    /* options */
  })
);
```
