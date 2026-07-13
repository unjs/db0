---
icon: cbi:neon
---

# NEON INSTANT

> The [Neon connector](/connectors/neon), plus a database provisioned for you when you don't have one yet.

:read-more{to="https://neon.com/docs/reference/neon-new"}

## Instant Postgres Provisioning

This connector behaves exactly like the [Neon connector](/connectors/neon), except that it does not require a connection string. When instantiated without one **outside of production**, it provisions a claimable Postgres database via [`neon-new`](https://www.npmjs.com/package/neon-new) and connects to it. It can also seed schema and data from a `.sql` file.

This is intended as a development-time affordance. When `NODE_ENV` is `production`, nothing is provisioned and a missing connection string throws — use the [Neon connector](/connectors/neon) there.

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

The generated connection string is written to your `.env` file, so subsequent runs reuse the same database.

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
- File the generated connection string is written to, and the variable name it is written under.

### `referrer`

- **Type:** `string` _(optional)_
- **Default:** `"db0/neon-connector"`
- Referrer name Neon uses for tracking.
