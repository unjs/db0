---
navigation.title: Turso
---

# Turso Connector

Connect to [Turso](https://turso.tech/) database. Follow up via [unjs/db0#11](https://github.com/unjs/db0/issues/11).

::alert{type="primary"}
🚀 This connector will be comming soon!
::

```js
import { createDatabase, sql } from "db0";
import vercelPostgres from "db0/connectors/turso";

const db = createDatabase(
  turso({
    /* options */
  }),
);
```
