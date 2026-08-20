---
icon: cbi:neon
---

# NEON

> Very similar to [Postgres connector](/connectors/postgresql), but optimized for serverless environments.

:read-more{to="https://neon.com"}

## Why Neon Connector?

The fundamental difference is that Postgres Connector uses the [node-postgres](https://node-postgres.com/) driver, which needs a raw TCP connection, while Neon uses [neondatabase/serverless](https://neon.com/docs/serverless/serverless-driver), whose `Client` speaks postgres over WebSockets. The drivers have feature parity, but the connection type creates some runtime differences.

A WebSocket connection is usually preferred over TCP for serverless environments because many of those runtimes cannot open raw TCP sockets at all.

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

:read-more{title="Query parameters" to="/connectors/postgresql#query-parameters"}

## Options

Options are passed through to the underlying [`Client`](https://neon.com/docs/serverless/serverless-driver), so any `ClientConfig` field is accepted in addition to the following.

### `url` or `connectionString`

- **Type:** `string`
- Connection string to your Neon database.
- Optional if the database is identified another way, such as a `host` in the `ClientConfig`. If neither is present, the first query throws (the client connects lazily).
