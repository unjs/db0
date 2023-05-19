---
navigation.title: PostgreSQL
---

# PostgreSQL Connector

## Usage

For this connector, you need to install [`pg`](https://www.npmjs.com/package/pg) dependency:

::code-group

```sh [npm]
npm install pg@8 @types/pg@8
```

```sh [Yarn]
yarn add pg@8 @types/pg@8
```

```sh [pnpm]
pnpm add pg@8 @types/pg@8
```

::

```js
import { createDB, sql } from "sql0";
import postgresql from "sql0/connectors/postgresql";

const db = createDB(
  postgresql({
    bindingName: "DB",
  })
);
```

## Options

### `url`

Connection URL string.

Alternatively, you can add connection configuration. See [node-postgres](https://node-postgres.com/apis/client#new-client) documentation for more information.
