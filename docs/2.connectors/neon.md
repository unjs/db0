---
icon: cbi:neon
---

# NEON

> Very similar to [Postgres connector](/connectors/postgresql), but optimized for serverless environments.

:read-more{to="https://neon.com"}

## Why Neon Connector?

The fundamental difference is that Postgres Connector uses the [node-postgres](https://node-postgres.com/) driver, which uses a TCP connection, while Neon uses [neondatabase/serverless](https://neon.com/docs/serverless/serverless-driver) and uses a HTTP/Web-Sockets connector. While the drivers have feature parity, the connection type creates some runtime differences.

The HTTP/WS connection is usually preferred over TCP for serverless environments because:

- Historically, some runtimes did not work well with TCP connections.
- Reduced latency as a consequence of fewer required network trips per query.
- Reduce number of SCRAM authentication calls.

Additionally to the runtime differences, Neon connector also allows to automatically seed and instantiate a fresh Postgres instance if initialized without a connection string.

## Instant Postgres Provisioning

If the connector's client is instantiated without a connection string **in development**, the Neon connector will automatically generate a connection string. It will also seed schema and data if provided with a `.sql` file.

## Usage

Install Neon Servleress Driver for the postgres connection and Instagres' `get-db` package to auto-generate the connection string in development.

:pm-install{name="@neondatabse/serverless get-db"}

With those dependencies installed, you can immediately start building:

```ts
import { createDatabase } from "db0";
import neon from "db0/connectors/neon";

const db = createDatabase(
  neon({
    bindingName: "DB",
    seed: "init.sql",
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

## Options

### `connectionString` or `url`

- **Type:** `string` _(optional)_
- Manually provide a connection string to your Neon database.
- If not provided, it will use the value from the environment variable or automatically provision a database (in development).

### `seed`

- **Type:** `string` _(optional)_
- **Default:** `undefined`
- Path to a `.sql` file for seeding the database schema and initial data.
- If set to `false`, seeding will be disabled.
