---
navigation.title: PlanetScale
---

# PlanetScale Connector

Connect to [Planetscale](https://planetscale.com/) database.

::alert{type="primary"}
🚀 This connector will be comming soon! Follow up via [unjs/db0#4](https://github.com/unjs/db0/issues/4).
::

```js
import { createDB, sql } from "db0";
import planetscale from "db0/connectors/planetscale";

const db = createDB(
  planetscale({
    /* options */
  })
);
```
