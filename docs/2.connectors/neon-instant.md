---
icon: cbi:neon
---

# NEON INSTANT

> The [Neon connector](/connectors/neon), plus a database provisioned for you when you don't have one yet.

:read-more{to="https://neon.com/docs/reference/neon-new"}

## Instant Postgres Provisioning

This connector behaves exactly like the [Neon connector](/connectors/neon), except that it does not require a connection string. On first use, it resolves one in this order:

1. The `url` / `connectionString` option, if given.
2. The `DATABASE_URL` environment variable (see [`dotEnvKey`](#dotenvfile-dotenvkey)), if set.
3. Otherwise, it provisions a claimable Postgres database via [`neon-new`](https://www.npmjs.com/package/neon-new), optionally seeding it from a `.sql` file.

This is intended as a development-time affordance. When `NODE_ENV` is `production`, nothing is provisioned and a missing connection string throws — use the [Neon connector](/connectors/neon) there.

`neon-new` is imported lazily, only when a database actually has to be provisioned, so it stays out of your production bundle.

## Usage

Install the Neon Serverless Driver for the postgres connection, and `neon-new` to provision the database.

:pm-install{name="@neondatabase/serverless neon-new"}

With those dependencies installed, you can immediately start building:

```ts
import { createDatabase } from "db0";
import neonInstant from "db0/connectors/neon-instant";

const db = createDatabase(
  neonInstant({
    seed: { type: "sql-script", path: "init.sql" },
  }),
);
```

```sql [init.sql]
CREATE TABLE IF NOT EXISTS xmen (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

INSERT INTO xmen (name) VALUES
  ('Wolverine'),
  ('Cyclops'),
  ('Storm'),
  ('Jean Grey'),
  ('Beast'),
  ('Professor X'),
  ('Gambit'),
  ('Rogue'),
  ('Nightcrawler')
ON CONFLICT DO NOTHING;
```

The generated connection string is appended to your `.env` file. As long as that file is loaded into `process.env` (with `dotenv`, or natively via `node --env-file`), later runs pick it up and reuse the same database instead of provisioning a new one.

## Options

Accepts every [Neon connector option](/connectors/neon#options), plus the [`neon-new` parameters](https://www.npmjs.com/package/neon-new) below.

### `url` or `connectionString`

- **Type:** `string` _(optional)_
- Connection string to an existing Neon database.
- If provided, no database is provisioned.

### `seed`

- **Type:** `{ type: "sql-script", path: string }` _(optional)_
- **Default:** `undefined`
- Path to a `.sql` file for seeding the database schema and initial data.

### `dotEnvFile` / `dotEnvKey`

- **Type:** `string` _(optional)_
- **Default:** `".env"` and `"DATABASE_URL"`
- File the generated connection string is written to, and the variable name it is written under. `dotEnvKey` is also the environment variable read to reuse an existing database.

### `envPrefix`

- **Type:** `string` _(optional)_
- **Default:** `"PUBLIC_"`
- Prefix used for the public environment variables written alongside the connection string.

### `settings`

- **Type:** `{ logicalReplication?: boolean }` _(optional)_
- Extra settings for the provisioned database.

### `referrer`

- **Type:** `string` _(optional)_
- **Default:** `"db0/neon-connector"`
- Referrer name Neon uses for tracking.

### `provisionLib`

- **Type:** `typeof import("neon-new")` or a function returning it _(optional)_
- Provide `neon-new` yourself instead of letting the connector import it dynamically, the same way [`lib`](/connectors#connector-dependencies) works for the database driver.
