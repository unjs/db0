---
icon: simple-icons:planetscale
---

# PlanetScale

> Connect DB0 to Planetscale

:read-more{to="https://planetscale.com"}

## Usage

For this connector, you need to install [`@planetscale/database`](https://www.npmjs.com/package/@planetscale/database) dependency:

:pm-install{name="@planetscale/database"}

Use `planetscale` connector:

```js
import { createDatabase } from "db0";
import planetscale from "db0/connectors/planetscale";

const db = createDatabase(
  planetscale({
    host: "aws.connect.psdb.cloud",
    username: "username",
    password: "password",
  }),
);
```

## Options

### `host`

Planetscale host.

### `username`

Planetscale username.

### `password`

Planetscale password.

### 'url'

Connection URL string.
The `host`, `username` and `password` are extracted from the URL.

:read-more{title="Create a database password" to="https://planetscale.com/docs/tutorials/planetscale-serverless-driver"}

:read-more{title="@planetscale/database client options" to="https://github.com/planetscale/database-js"}
