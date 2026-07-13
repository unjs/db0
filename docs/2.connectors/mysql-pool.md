---
icon: simple-icons:mysql
---
# MySQL (Pool)

> Connect DB0 to Mysql Database using mysql2 pool connection

## Usage

For this connector, you need to install [`mysql2`](https://www.npmjs.com/package/mysql2) dependency:

:pm-install{name="mysql2"}

Use `mysql2-pool` connector:

```js
import { createDatabase } from "db0";
import mysqlPool from "db0/connectors/mysql2-pool";

const db = createDatabase(
  mysqlPool({
    /* options */
  }),
);
```

### Pool Query

```js
const {rows} = db.sql`SELECT * FROM tbl`;
```

### Transactions

For pool connections, do not use transactions with the **pool.query** method.

:read-more{title="node-postgres transactions" to="https://pg.nodejs.cn/features/transactions"}



To use transactions, get an instance first and dispose after finished.

```js
const c = await db.getInstance();
await c.sql`BEGIN`;
await c.sql`insert into test (name) values ('TEST1')`;
await c.sql`COMMIT`;
await c.sql`BEGIN`;
await c.sql`insert into test (name) values ('TEST2')`;
await c.sql`ROLLBACK`;
c.dispose();
```

The pid can test by:

```js
// Pool query: different pids
new Array(10).fill(1).forEach(async () => {
  const {rows} = await db.sql`SELECT pg_backend_pid()`;
  console.log(rows[0]);
});

// PoolConnection query: the same pid
const c = await db.getInstance();
new Array(10).fill(1).forEach(async () => {
  const {rows} = await c.sql`SELECT pg_backend_pid()`;
  console.log(rows[0]);
});
```

Options

:read-more{to="https://github.com/sidorares/node-mysql2/blob/master/typings/mysql/lib/Connection.d.ts#L82-L329"}
