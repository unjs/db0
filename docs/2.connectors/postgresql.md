---
icon: simple-icons:postgresql
---

# PostgreSQL

> Connect DB0 to PostgreSQL

:read-more{to="https://www.postgresql.org"}

## Usage

For this connector, you need to install [`pg`](https://www.npmjs.com/package/pg) dependency:

:pm-install{name="pg @types/pg"}

Use `postgresql` connector:

```js
import { createDatabase } from "db0";
import postgresql from "db0/connectors/postgresql";

const db = createDatabase(
  postgresql({
    bindingName: "DB",
  }),
);
```

## Options

### `url`

Connection URL string.

Alternatively, you can add connection configuration.

:read-more{title="node-postgres client options" to="https://node-postgres.com/apis/client#new-client"}
