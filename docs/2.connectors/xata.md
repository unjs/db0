---
icon: radix-icons:xata-logo
---

# Xata

> Connect DB0 to Xata Postgres

:read-more{to="https://xata.io/docs/postgres"}

## Usage

Use [`postgres`](/connectors/postgresql) connector:

```js
import { createDatabase, sql } from "db0";
import postgres from "db0/connectors/postgres";

const db = createDatabase(
  postgres({
    /* options */
  }),
);
```
