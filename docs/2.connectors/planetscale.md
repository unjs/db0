---
icon: simple-icons:planetscale
---

# PlanetScale

> Connect DB0 to Planetscale

:read-more{to="https://planetscale.com"}

> [!WARNING]
> 🚀 This connector will be supported soon! Follow up via [unjs/db0#4](https://github.com/unjs/db0/issues/4).

## Usage

Use `planetscale` connector:

```js
import { createDatabase, sql } from "db0";
import planetscale from "db0/connectors/planetscale";

const db = createDatabase(
  planetscale({
    /* options */
  }),
);
```
