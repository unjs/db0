---
icon: devicon-plain:cloudflareworkers
---

# Cloudflare D1

> Connect DB0 to Cloudflare D1

:read-more{to="https://developers.cloudflare.com/d1"}

> [!NOTE]
> This connector works within cloudflare workers with D1 enabled.

## Usage

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

## Options

### `bindingName`

Assigned binding name.
