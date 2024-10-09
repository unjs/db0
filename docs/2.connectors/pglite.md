---
icon: simple-icons:postgresql
---

# PGlite

> Connect DB0 to Postgres using PGlite

:read-more{to="https://pglite.dev"}

## Usage

For this connector, you need to install [`@electric-sql/pglite`](https://www.npmjs.com/package/@electric-sql/pglite) dependency:

:pm-i{name="@electric-sql/pglite"}

Use `pglite` connector:

```js
import { createDatabase, sql } from "db0";
import pglite from "db0/connectors/pglite";

const db = createDatabase(
  pglite({
    /* options */
  }),
);
```

<!-- copy from https://pglite.dev/docs/api#main-constructor -->
## Options

### `dataDir`

Path to the directory for storing the Postgres database. You can provide a URI scheme for various storage backends:

- **`file://` or unprefixed**: File system storage, available in Node and Bun.
- **`idb://`**: IndexedDB storage, available in the browser.
- **`memory://`**: In-memory ephemeral storage, available on all platforms.

### `options`

#### `dataDir`

The directory in which to store the Postgres database when not provided as the first argument.

**Type:** `string`

#### `debug`

Postgres debug level. Logs are sent to the console.

**Type:** `1 | 2 | 3 | 4 | 5`

#### `relaxedDurability`

Under relaxed durability mode, PGlite will not wait for flushes to storage to complete after each query before returning results. This is particularly useful when using the IndexedDB file system.

**Type:** `boolean`

#### `fs`

An alternative to providing a `dataDir` with a filesystem prefix. Initialize a `Filesystem` yourself and provide it here.

**Type:** `Filesystem`

#### `loadDataDir`

A tarball of a PGlite datadir to load when the database starts. This should be a tarball produced from the related `.dumpDataDir()` method.

**Type:** `Blob | File`

#### `extensions`

An object containing the extensions you wish to load.

**Type:** `{ [namespace: string]: Extension }`

#### `username`

The username of the user to connect to the database as. Permissions will be applied in the context of this user.

**Type:** `string`

#### `database`

The database from the Postgres cluster within the `dataDir` to connect to.

**Type:** `string`

#### `initialMemory`

The initial amount of memory in bytes to allocate for the PGlite instance. PGlite will grow the memory automatically, but if you have a particularly large database, you can set this higher to prevent the pause during memory growth.

**Type:** `number`