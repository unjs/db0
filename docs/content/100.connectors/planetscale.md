---
navigation.title: PlanetScale
---

# PlanetScale Connector

Connect to [Planetscale](https://planetscale.com/) database.

::alert{type="primary"}
🚀 This connector will be comming soon! Follow up via [unjs/sql0#4](https://github.com/unjs/sql0/issues/4).
::

```js
import { createDB, sql } from "sql0";
import planetscale from "sql0/connectors/planetscale";

const db = createDB(
  planetscale({
    /* options */
  })
);
```
