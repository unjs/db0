---
navigation.title: Turso
---

# Turso Connector

Connect to [Turso](https://turso.tech/) database. Follow up via [unjs/sql0#11](https://github.com/unjs/sql0/issues/11).

::alert{type="primary"}
🚀 This connector will be comming soon!
::

```js
import { createDB, sql } from "sql0";
import vercelPostgres from "sql0/connectors/turso";

const db = createDB(
  turso({
    /* options */
  })
);
```
