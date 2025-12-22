---
icon: simple-icons:postgresql
---
# PostgreSQL (Pool)

> Connect DB0 to PostgreSQL

:read-more{to="https://www.postgresql.org"}

## Usage

For this connector, you need to install [`pg`](https://www.npmjs.com/package/pg) dependency:

:pm-install{name="pg @types/pg"}

Use `postgresql-pool` connector:

```js
import { createDatabase } from "db0";
import postgresqlPool from "db0/connectors/postgresql-pool";

const db = createDatabase(
  postgresqlPool({
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

## Options

:read-more{title="node-postgres client options" to="https://node-postgres.com/apis/client#new-client"}
