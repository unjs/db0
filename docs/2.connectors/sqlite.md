---
icon: simple-icons:sqlite
---

# SQLite

> Connect DB0 to SQLite using one of the following connectors:
> - [better-sqlite3](#better-sqlite3)
> - [node-sqlite3](#node-sqlite3)

<!-- :read-more{to=""} -->

## `better-sqlite3`

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

## `node-sqlite3`

For this connector, you need to install [`sqlite3`](https://www.npmjs.com/package/sqlite3) dependency:

:pm-install{name="sqlite3"}

Use `node-sqlite3` connector:

```js
import { createDatabase } from "db0";
import sqlite from "db0/connectors/node-sqlite3";

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
