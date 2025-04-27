---
icon: simple-icons:postgresql
---

# Cloudflare Hyperdrive PostgreSQL

> Connect DB0 to Cloudflare Hyperdrive PostgreSQL

:read-more{to="https://developers.cloudflare.com/hyperdrive"}

> [!NOTE]
> This connector works within Cloudflare Workers with Hyperdrive enabled.

## Usage

For this connector, you need to install [`pg`](https://www.npmjs.com/package/pg) dependency:

:pm-install{name="pg @types/pg"}

Use `cloudflare-hyperdrive-postgresql` connector:

```js
import { createDatabase } from "db0";
import cloudflareHyperdrivePostgresql from "db0/connectors/cloudflare-hyperdrive-postgresql";

const db = createDatabase(
  cloudflareHyperdrivePostgresql({
    bindingName: "POSTGRESQL",
  }),
);
```

## Options

### `bindingName`

Assigned binding name for your Hyperdrive instance.

### Additional Options

You can also pass PostgreSQL client configuration options (except for `user`, `database`, `password`, `port`, `host`, and `connectionString` which are managed by Hyperdrive):

```js
const db = createDatabase(
  cloudflareHyperdrivePostgresql({
    bindingName: "HYPERDRIVE",
    // Additional PostgreSQL options
    statement_timeout: 5000,
    query_timeout: 10000,
  }),
);
```

:read-more{title="node-postgres documentation" to="https://node-postgres.com/apis/client#new-client"}
