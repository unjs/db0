---
icon: simple-icons:turso
---

# Turso

> Connect DB0 to Turso database

:read-more{to="https://turso.tech"}

> [!WARNING]
> 🚀 This connector will be supported soon! Follow up via [unjs/db0#11](https://github.com/unjs/db0/issues/11).

Use ~~`turso`~~ connector:

```js
import { createDatabase, sql } from "db0";
import vercelPostgres from "db0/connectors/turso";

const db = createDatabase(
  turso({
    /* options */
  }),
);
```
