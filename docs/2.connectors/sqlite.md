---
icon: simple-icons:sqlite
---

# SQLite

> Connect DB0 to SQLite using better-sqlite3

<!-- :read-more{to=""} -->

## Usage

For this connector, you need to install [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) dependency:

:pm-i{name="better-sqlite3@8"}

Use `better-sqlite3` connector:

```js
import { createDatabase, sql } from "db0";
import sqlite from "db0/connectors/better-sqlite3";

const db = createDatabase(
  sqlite({
    /* options */
  }),
);
```

## Options

### `cwd`

Working directory to create database. Default is current working directory of project. (It will be ignored if `path` is provided an absolute path.)

### `name`

Database (file) name. Default is `db`

### `path`

Related (to `cwd`) or absolute path to the sql file. By default it is stored in `{cwd}/.data/{name}.sqlite3` / `.data/db.sqlite3`
