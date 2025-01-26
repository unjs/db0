---
icon: cbi:neon
---

# NEON

> Connect DB0 to Neon Serverless Postgres.

:read-more{to="https://neon.tech"}

## Usage

For this connector, you need to install [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless) dependency:

:pm-install{name="@neondatabase/serverless"}

Use `neon` connector:

```js
import { createDatabase } from "db0";
import neonConnector from "db0/connectors/neon";

const db = createDatabase(
  neonConnector({
    /* options */
  }),
);
```

## Options

### `url`

The URL of the Neon Serverless Postgres instance.

**Type:** `string`

:read-more{to="https://neon.tech/docs/serverless/serverless-driver#neon-function-configuration-options"}
