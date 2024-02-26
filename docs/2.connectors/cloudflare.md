---
icon: devicon-plain:cloudflareworkers
---

# Cloudflare D1

> Connect DB0 to Cloudflare D1 database

:read-more{to="https://developers.cloudflare.com/d1"}

> [!NOTE]
> This connector works within cloudflare workers with D1 enabled.

## Usage

Use `cloudflare-d1` connector:

```js
import { createDatabase, sql } from "db0";
import cloudflareD1 from "db0/connectors/cloudflare-d1";

const db = createDatabase(
  cloudflareD1({
    bindingName: "DB",
  }),
);
```

## Options

### `bindingName`

Assigned binding name.
