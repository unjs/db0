---
icon: simple-icons:turso
---

# Turso

> Connect DB0 to Turso

:read-more{to="[https://turso.org](https://docs.turso.tech/local-development)"}


## Usage

Include your Turso API .env variables.

```
// https://docs.turso.tech/api-reference/quickstart
TURSO_DB_URL=
TURSO_DB_AUTH_TOKEN=
```

```ts
import { createDatabase, sql } from "db0"; 
import libSql from "db0/connectors/libsql/node";
import { drizzle } from "db0/integrations/drizzle";

// Initialize DB instance
const db = createDatabase(libSql({ url: process.env.TURSO_DB_URL, authToken: process.env.TURSO_DB_AUTH_TOKEN }));
```

## Usage with Nuxt 3 and Nitro

> [!IMPORTANT]
> Database support is currently experimental.
> Refer to the [db0 issues](https://github.com/unjs/db0/issues) for status and bug report.

For this connector, you need to install the `better-sqlite3` dependency.
In order to enable the database layer you also need to enable the experimental feature flag.

::code-group

```ts [nuxt.config.ts]
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  nitro: {
    experimental: {
      database: true
    },
    database: {
      devDatabase: {
        connector: 'sqlite',
        options: { name: 'devDb' }
      },
      default: {
        connector: 'libsql',
        options: {
          url: process.env.TURSO_DB_URL,
          authToken: process.env.TURSO_DB_AUTH_TOKEN
        }
      }
    }
  }
})
```

```ts [nitro.config.ts]
// https://nitro.unjs.io/config
export default defineNitroConfig({
  experimental: {
    database: true,
  },
  database: {
    devDatabase: {
      connector: 'sqlite',
      options: { name: 'devDb' }
    },
    default: {
      connector: 'libsql',
      options: {
        url: process.env.TURSO_DB_URL,
        authToken: process.env.TURSO_DB_AUTH_TOKEN,
      }
    }
  }
})
```

## Options

### `url`

Type: `string`

The database URL. The client supports `libsql:` , `http:` / `https:` , `ws:` / `wss:` and `file:` URL. For more information, please refer to the project README: [link](https://github.com/libsql/libsql-client-ts#supported-urls)

---

### `authToken`

Type: `string` (optional)

Authentication token for the database.

---

### `tls`

Type: `boolean` (optional)

Enables or disables TLS for `libsql:` URLs. By default, `libsql:` URLs use TLS. You can set this option to `false` to disable TLS.

---

### `intMode`

Type: `IntMode` (optional)

How to convert SQLite integers to JavaScript values:

- `"number"` (default): returns SQLite integers as JavaScript `number`-s (double precision floats). `number` cannot precisely represent integers larger than 2^53-1 in absolute value, so attempting to read larger integers will throw a `RangeError`.
- `"bigint"`: returns SQLite integers as JavaScript `bigint`-s (arbitrary precision integers). Bigints can precisely represent all SQLite integers.
- `"string"`: returns SQLite integers as strings.


## References

- [Turso Website](https://turso.tech/)
- [LibSQL Website](https://libsql.org/)
- [Drizzle Website](https://orm.drizzle.team/docs/overview)
- [Turso API Keys Quickstart](https://docs.turso.tech/api-reference/quickstart)
- [Nuxt Github Example](https://github.com/justserdar/jsd-nuxt-turso-drizzle/tree/nightly)
