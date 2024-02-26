---
icon: clarity:node-line
---

# LibSQL

> Connect DB0 to LibSQL

:read-more{to="https://libsql.org"}

## Usage

For this connector, you need to install [`@libsql/client`](https://www.npmjs.com/package/@libsql/client) dependency:

:pm-install{name="@libsql/client"}

Choose on of the `libsql`, `libsql/http` or `libsql/web` connectors depending on your usage requirements:

::code-group

```ts [libsql.node.js]
import { createDatabase, sql } from "db0";
import libSql from "db0/connectors/libsql";

const db = createDatabase(libSql({ url: `file:local.db` }));
```

```ts [libsql.http.js]
import { createDatabase, sql } from "db0";
import libSql from "db0/connectors/libsql/http";

const db = createDatabase(libSql({}));
```

```ts [libsql.web.js]
import { createDatabase, sql } from "db0";
import libSql from "db0/connectors/libsql/web";

const db = createDatabase(libSql({}));
```

::

## Options

### `url`

Type: `string`

The database URL. The client supports `libsql:`, `http:`/`https:`, `ws:`/`wss:` and `file:` URL. For more information, please refer to the project README: [link](https://github.com/libsql/libsql-client-ts#supported-urls)

---

### `authToken`

Type: `string` (optional)

Authentication token for the database.

---

### `tls`

Type: `boolean` (optional)

Enables or disables TLS for `libsql:` URLs. By default, `libsql:` URLs use TLS. You can set this option to `false` to disable TLS.

---

### `intMode`

Type: `IntMode` (optional)

How to convert SQLite integers to JavaScript values:

- `"number"` (default): returns SQLite integers as JavaScript `number`-s (double precision floats). `number` cannot precisely represent integers larger than 2^53-1 in absolute value, so attempting to read larger integers will throw a `RangeError`.
- `"bigint"`: returns SQLite integers as JavaScript `bigint`-s (arbitrary precision integers). Bigints can precisely represent all SQLite integers.
- `"string"`: returns SQLite integers as strings.

## References

- [LibSQL Website](https://libsql.org/)
- [LibSQL GitHub Repository](https://github.com/libsql/libsql)
- [LibSQL Client API Reference](https://libsql.org/libsql-client-ts/index.html)
- [LibSQL Client GitHub Repository](https://github.com/libsql/libsql-client-ts)
