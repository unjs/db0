---
icon: simple-icons:mysql
---

# Cloudflare Hyperdrive MySQL

> Connect DB0 to Cloudflare Hyperdrive MySQL

:read-more{to="https://developers.cloudflare.com/hyperdrive"}

> [!NOTE]
> This connector works within Cloudflare Workers with Hyperdrive enabled.

## Usage

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

## Options

### `bindingName`

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
