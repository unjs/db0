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

## Usage

Install the Neon Serverless Driver for the postgres connection.

:pm-install{name="@neondatabase/serverless"}

This connector always connects to an existing database, so a connection string is required.

```ts
import { createDatabase } from "db0";
import neon from "db0/connectors/neon";

const db = createDatabase(
  neon({
    url: process.env.DATABASE_URL,
  }),
);
```

::tip
Want a database provisioned for you in development, without bringing your own connection string? Use the [Neon Instant connector](/connectors/neon-instant).
::

## Options

Options are passed through to the underlying [`Client`](https://neon.com/docs/serverless/serverless-driver), so any `ClientConfig` field is accepted in addition to the following.

### `url` or `connectionString`

- **Type:** `string`
- Connection string to your Neon database.
- If neither is provided, creating the client throws.
