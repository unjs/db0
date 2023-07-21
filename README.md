# DB0

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Codecov][codecov-src]][codecov-href]
[![bundle][bundle-src]][bundle-href]

<!-- [![License][license-src]][license-href] -->
<!--[![Github Actions][github-actions-src]][github-actions-href]-->

DB0 provides an easy interface to connect and query sql databases providers with a tiny core.

👉 Read [Documentation](https://db0.unjs.io)

> **Warning**
> This project is under heavy development and API might change.

## Usage

Install `db0` npm package:

```sh
# yarn
yarn add db0

# npm
npm install db0

# pnpm
pnpm add db0
```

```js
import { createDatabase, sql } from "db0";
import sqlite from "db0/connectors/better-sqlite3";

// Initiate database with SQLite connector
const db = createDatabase(sqlite({}));

// Create users table
await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

// Add a new user
const userId = "1001";
await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

// Query for users
const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;
console.log(rows);
```

<!-- 👉 Check out the [the documentation](https://db0.unjs.io) for usage information. -->

## Contribution

- Clone repository
- Install dependencies with `pnpm install`
- Use `pnpm dev` to start jest watcher verifying changes
- Use `pnpm test` before pushing to ensure all tests and lint checks passing

## License

[MIT](./LICENSE)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/db0?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/db0
[npm-downloads-src]: https://img.shields.io/npm/dm/db0?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/db0
[github-actions-src]: https://img.shields.io/github/workflow/status/unjs/db0/ci/main?style=flat&colorA=18181B&colorB=F0DB4F
[github-actions-href]: https://github.com/unjs/db0/actions?query=workflow%3Aci
[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/db0/main?style=flat&colorA=18181B&colorB=F0DB4F
[codecov-href]: https://codecov.io/gh/unjs/db0
[bundle-src]: https://img.shields.io/bundlephobia/minzip/db0?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=db0
[license-src]: https://img.shields.io/github/license/unjs/db0.svg?style=flat&colorA=18181B&colorB=F0DB4F
[license-href]: https://github.com/unjs/db0/blob/main/LICENSE
