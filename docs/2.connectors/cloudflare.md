---
icon: devicon-plain:cloudflareworkers
---

# Cloudflare

> Connect DB0 to Cloudflare D1 or PostgreSQL/MySQL using Cloudflare Hyperdrive


## Cloudflare D1

:read-more{to="https://developers.cloudflare.com/d1"}

> [!NOTE]
> This connector works within cloudflare workers with D1 enabled.

### Usage

Use `cloudflare-d1` connector:

```js
import { createDatabase } from "db0";
import cloudflareD1 from "db0/connectors/cloudflare-d1";

const db = createDatabase(
  cloudflareD1({
    bindingName: "DB",
  }),
);
```

> [!NOTE]
> In order for the driver to work, `globalThis.__env__.DB` value should be set.
>
> If you are using [Nitro](https://nitro.unjs.io/) you don't need to do any extra steps.

### Options

#### `bindingName`

Assigned binding name.

---

## Hyperdrive PostgreSQL

:read-more{to="https://developers.cloudflare.com/hyperdrive"}

> [!NOTE]
> This connector works within Cloudflare Workers with Hyperdrive enabled.

### Usage

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

### Options

#### `bindingName`

Assigned binding name for your Hyperdrive instance.

#### Additional Options

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

---

## Hyperdrive MySQL

:read-more{to="https://developers.cloudflare.com/hyperdrive"}

> [!NOTE]
> This connector works within Cloudflare Workers with Hyperdrive enabled.

### Usage

For this connector, you need to install [`mysql2`](https://www.npmjs.com/package/mysql2) dependency:

:pm-install{name="mysql2"}

Use `cloudflare-hyperdrive-mysql` connector:

```js
import { createDatabase } from "db0";
import cloudflareHyperdriveMysql from "db0/connectors/cloudflare-hyperdrive-mysql";

const db = createDatabase(
  cloudflareHyperdriveMysql({
    bindingName: "MYSQL",
  }),
);
```

### Options

#### `bindingName`

Assigned binding name for your Hyperdrive instance.

### Additional Options

You can also pass MySQL client configuration options (except for connection/authentication options which are managed by Hyperdrive, and `disableEval` which is incompatible in Cloudflare Workers):

```js
const db = createDatabase(
  cloudflareHyperdriveMysql({
    bindingName: "HYPERDRIVE",
    // Additional MySQL options
    connectTimeout: 10000,
    queryTimeout: 5000,
  }),
);
```

:read-more{to="https://github.com/sidorares/node-mysql2/blob/master/typings/mysql/lib/Connection.d.ts#L82-L329"}
