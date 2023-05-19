# 💾 sql0

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![Codecov][codecov-src]][codecov-href]
[![bundle][bundle-src]][bundle-href]
[![License][license-src]][license-href]

<!--[![Github Actions][github-actions-src]][github-actions-href]-->

sql0 provides an easy way to connect and query sql databases providers with a [tiny core](https://bundlephobia.com/package/sql0).

<!-- 👉 [Documentation](https://sql0.unjs.io) -->

## Features

- Designed for all environments: Browser, NodeJS, and Workers
- Well tested built-in connectors
- Asynchronous API

## Usage

Install `sql0` npm package:

```sh
# yarn
yarn add sql0

# npm
npm install sql0

# pnpm
pnpm add sql0
```

```js
import { createDB, sql } from "sql0";
import sqlite from "sql0/connectors/better-sqlite3";

const db = createDB(sqlite({}));

await db.exec(
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, firstName TEXT, lastName TEXT, email TEXT)"
);

await db.prepare("INSERT INTO users VALUES (?, 'John', 'Doe', '')").run(id);

const row = await db.prepare("SELECT * FROM users WHERE id = ?").get(id);

console.log(row);
```

<!-- 👉 Check out the [the documentation](https://sql0.unjs.io) for usage information. -->

## Contribution

- Clone repository
- Install dependencies with `pnpm install`
- Use `pnpm dev` to start jest watcher verifying changes
- Use `pnpm test` before pushing to ensure all tests and lint checks passing

## License

[MIT](./LICENSE)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/sql0?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/sql0
[npm-downloads-src]: https://img.shields.io/npm/dm/sql0?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/sql0
[github-actions-src]: https://img.shields.io/github/workflow/status/unjs/sql0/ci/main?style=flat&colorA=18181B&colorB=F0DB4F
[github-actions-href]: https://github.com/unjs/sql0/actions?query=workflow%3Aci
[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/sql0/main?style=flat&colorA=18181B&colorB=F0DB4F
[codecov-href]: https://codecov.io/gh/unjs/sql0
[bundle-src]: https://img.shields.io/bundlephobia/minzip/sql0?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=sql0
[license-src]: https://img.shields.io/github/license/unjs/sql0.svg?style=flat&colorA=18181B&colorB=F0DB4F
[license-href]: https://github.com/unjs/sql0/blob/main/LICENSE
