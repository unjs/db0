---
icon: simple-icons:bun
---

# Bun SQlite

> Connect DB0 to Bun SQLite

:read-more{to="https://bun.sh/docs/api/sqlite"}

> [!NOTE]
> This connector needs Bun as runtime. Use `bun --bun ...` to make sure of this.

## Usage

Use `bun-sqlite` connector:

```js
import { createDatabase } from "db0";
import bunSqlite from "db0/connectors/bun-sqlite";

const db = createDatabase(bunSqlite({}));
```

## Options

### `name`

Database (file) name. Default is `:memory`.

### `cwd`

Working directory to create database. Default is current working directory of project. (It will be ignored if `path` is provided an absolute path or if name is `:memory` or empty).

### `path`

Related (to `cwd`) or absolute path to the sql file. By default it is stored in `{cwd}/.data/{name}.bun.sqlite` / `.data/db.bun.sqlite`
