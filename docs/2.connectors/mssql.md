---
icon: devicon-plain:microsoftsqlserver
---

# MSSQL

> Connect DB0 to MSSQL Database using `tedious`

## Usage

For this connector, you need to install [`tedious`](https://www.npmjs.com/package/tedious) dependency:

:pm-install{name="tedious"}

Use `mssql` connector:

```js
import { createDatabase } from "db0";
import mysql from "db0/connectors/mssql";

const db = createDatabase(
  mssql({
    /* options */
  }),
);
```

## Options

:read-more{to="https://tediousjs.github.io/tedious/api-connection.html#function_newConnection"}
