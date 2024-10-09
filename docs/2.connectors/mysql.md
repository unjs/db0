---
icon: simple-icons:mysql
---

# MySQL

> Connect DB0 to Mysql Database using mysql2

## Usage

For this connector, you need to install [`mysql2`](https://www.npmjs.com/package/mysql2) dependency:

:pm-install{name="mysql2"}

Use `mysql2` connector:

```js
import { createDatabase } from "db0";
import mysql from "db0/connectors/mysql2";

const db = createDatabase(
  mysql({
    /* options */
  }),
);
```

## Options

:read-more{to="https://github.com/sidorares/node-mysql2/blob/master/typings/mysql/lib/Connection.d.ts#L82-L329"}
