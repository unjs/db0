---
navigation.title: Cloudflare D1
---

# Cloudflare D1 Connector

## Usage

This connector works within cloudflare workers with D1 enabled. [Read More](https://developers.cloudflare.com/d1/)

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
