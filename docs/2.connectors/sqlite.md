---
icon: simple-icons:sqlite
---

# SQLite

> Connect DB0 to local SQLite database with Node.js and Deno

You have 3 options for using SQLite:

- [`node-sqlite`](#node-sqlite) (recommended)
- [`better-sqlite3`](#better-sqlite3)
- [`sqlite3`](#sqlite3)

## `node-sqlite`

This driver uses native [`node:sqlite`](https://nodejs.org/api/sqlite.html) supported in Node.js >= 22.5 (experimental) and Deno >= [2.2](https://deno.com/blog/v2.2) and requires **no dependencies**!

:read-more{to="https://nodejs.org/api/sqlite.html" title="Node.js docs"}

:read-more{to="https://docs.deno.com/api/node/sqlite/" title="Deno docs"}

```js
import { createDatabase } from "db0";
import sqlite from "db0/connectors/node-sqlite";

const db = createDatabase(
  sqlite({
    name: ":memory:",
  }),
);
```

## `better-sqlite3`

:read-more{to="https://github.com/WiseLibs/better-sqlite3" title="better-sqlite3"}

For this connector, you need to install [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) dependency:

:pm-install{name="better-sqlite3"}

Use `better-sqlite3` connector:

```js
import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";

const db = createDatabase(
  sqlite({
    name: ":memory:",
  }),
);
```

### Options

#### `cwd`

Working directory to create database. Default is current working directory of project. (It will be ignored if `path` is provided an absolute path.)

#### `name`

Database (file) name. Default is `db`.

> [!NOTE]
> You can use `:memory:` as name for in-memory storage.

#### `path`

Related (to `cwd`) or absolute path to the sql file. By default it is stored in `{cwd}/.data/{name}.sqlite3` / `.data/db.sqlite3`

## `sqlite3`

:read-more{to="https://github.com/TryGhost/node-sqlite3" title="sqlite3"}

For this connector, you need to install [`sqlite3`](https://www.npmjs.com/package/sqlite3) dependency:

:pm-install{name="sqlite3"}

Use `sqlite3` connector:

```js
import { createDatabase } from "db0";
import sqlite from "db0/connectors/sqlite3";

const db = createDatabase(
  sqlite({
    name: ":memory:",
  }),
);
```

### Options

(same as [better-sqlite3](#better-sqlite3))
