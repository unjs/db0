---
icon: simple-icons:mariadb
---

# MySQL

> Connect DB0 to MariaDB Database using mariadb

## Usage

For this connector, you need to install [`mariadb`](https://www.npmjs.com/package/mariadb) dependency:

:pm-install{name="mariadb"}

Use `mariadb` connector:

```js
import { createDatabase } from "db0";
import mariadb from "db0/connectors/mariadb";

const db = createDatabase(
  mariadb({
    /* options */
  }),
);
```

## Options

:read-more{to="https://github.com/mariadb-corporation/mariadb-connector-nodejs/blob/main/types/share.d.ts#L603"}
