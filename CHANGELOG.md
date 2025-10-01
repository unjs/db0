# Changelog


## v0.3.4

[compare changes](https://github.com/unjs/db0/compare/v0.3.3...v0.3.4)

### 📦 Build

- Migrate to obuild ([8586320](https://github.com/unjs/db0/commit/8586320))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.3

[compare changes](https://github.com/unjs/db0/compare/v0.3.2...v0.3.3)

### 🚀 Enhancements

- Support `dispose` and `using createDatabase()` ([#178](https://github.com/unjs/db0/pull/178))
- Cloudflare hyperdrive ([#164](https://github.com/unjs/db0/pull/164))

### 💅 Refactors

- Strict types ([#179](https://github.com/unjs/db0/pull/179))

### 📖 Documentation

- Improve drizzle integration example with drizzle-kit usage ([#170](https://github.com/unjs/db0/pull/170))

### 🏡 Chore

- Update undocs ([d912de1](https://github.com/unjs/db0/commit/d912de1))
- Update docs ([d4a3cd5](https://github.com/unjs/db0/commit/d4a3cd5))
- Update undocs ([5d398ef](https://github.com/unjs/db0/commit/5d398ef))
- Update deps ([29ca18b](https://github.com/unjs/db0/commit/29ca18b))
- Update deps ([83f1425](https://github.com/unjs/db0/commit/83f1425))
- Lint ([9784e4d](https://github.com/unjs/db0/commit/9784e4d))
- Gitignore tsconfig.tsbuildinfo ([c68b294](https://github.com/unjs/db0/commit/c68b294))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))
- Fayaz Ahmed <fayazara@gmail.com>
- Rihan Arfan ([@RihanArfan](https://github.com/RihanArfan))

## v0.3.2

[compare changes](https://github.com/unjs/db0/compare/v0.3.1...v0.3.2)

### 🩹 Fixes

- **sqlite:** Defer prepare errors ([#162](https://github.com/unjs/db0/pull/162))

### 📖 Documentation

- Fix link to node-sqlite3 ([#159](https://github.com/unjs/db0/pull/159))

### 🏡 Chore

- Apply automated updates ([91b9863](https://github.com/unjs/db0/commit/91b9863))
- Update deps ([ad995db](https://github.com/unjs/db0/commit/ad995db))

### ✅ Tests

- Only include src for coverage report ([#161](https://github.com/unjs/db0/pull/161))

### ❤️ Contributors

- Farnabaz <farnabaz@gmail.com>
- Kanon ([@ysknsid25](https://github.com/ysknsid25))
- Pooya Parsa ([@pi0](https://github.com/pi0))
- Tsotne Nazarashvili <cotne.95@gmail.com>

## v0.3.1

[compare changes](https://github.com/unjs/db0/compare/v0.3.0...v0.3.1)

### 💅 Refactors

- Alias `sqlite` to `node-sqlite` ([55df331](https://github.com/unjs/db0/commit/55df331))

### 📦 Build

- Remove deprecated for aliases ([0011d57](https://github.com/unjs/db0/commit/0011d57))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.3.0

[compare changes](https://github.com/unjs/db0/compare/v0.2.4...v0.3.0)

### 🚀 Enhancements

- ⚠️  Prepared statements ([#157](https://github.com/unjs/db0/pull/157))
- `node-sqlite` driver with native `node:sqlite` ([#155](https://github.com/unjs/db0/pull/155))

### 🩹 Fixes

- **cloudflare-d1:** Correctly return results array ([#156](https://github.com/unjs/db0/pull/156))
- Fix type exports ([0d5a151](https://github.com/unjs/db0/commit/0d5a151))
- Correct `.getInstance()` type ([6a7dc5a](https://github.com/unjs/db0/commit/6a7dc5a))

### 💅 Refactors

- ⚠️  Rename `node-sqlite3` to `sqlite3` ([eb8c06d](https://github.com/unjs/db0/commit/eb8c06d))

### 📖 Documentation

- Add `node-sqlite` ([4da62b4](https://github.com/unjs/db0/commit/4da62b4))

### 📦 Build

- ⚠️  Esm-only dist ([7d7bdec](https://github.com/unjs/db0/commit/7d7bdec))

### 🏡 Chore

- Update deps ([a442671](https://github.com/unjs/db0/commit/a442671))
- Update deps ([77bee33](https://github.com/unjs/db0/commit/77bee33))
- Fix db0 link ([18b2bbc](https://github.com/unjs/db0/commit/18b2bbc))

#### ⚠️ Breaking Changes

- ⚠️  Prepared statements ([#157](https://github.com/unjs/db0/pull/157))
- ⚠️  Rename `node-sqlite3` to `sqlite3` ([eb8c06d](https://github.com/unjs/db0/commit/eb8c06d))
- ⚠️  Esm-only dist ([7d7bdec](https://github.com/unjs/db0/commit/7d7bdec))

### ❤️ Contributors

- Pooya Parsa ([@pi0](https://github.com/pi0))

## v0.2.4

[compare changes](https://github.com/unjs/db0/compare/v0.2.3...v0.2.4)

### 🩹 Fixes

- **bun-sqlite:** Remove in-memory fallback when name is not provided ([#153](https://github.com/unjs/db0/pull/153))

### 🏡 Chore

- Update deps ([cd49cad](https://github.com/unjs/db0/commit/cd49cad))
- Update ci ([b7a6ec9](https://github.com/unjs/db0/commit/b7a6ec9))
- Remove extra `@types/sqlite3` dev dependency ([a4df52b](https://github.com/unjs/db0/commit/a4df52b))
- Add pnpm stuff ([5c2d3cd](https://github.com/unjs/db0/commit/5c2d3cd))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Artem Melnyk ([@MellKam](http://github.com/MellKam))

## v0.2.3

[compare changes](https://github.com/unjs/db0/compare/v0.2.2...v0.2.3)

### 📦 Build

- Export `connectors` and connector ([d411f91](https://github.com/unjs/db0/commit/d411f91))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.2.2

[compare changes](https://github.com/unjs/db0/compare/v0.2.1...v0.2.2)

### 🚀 Enhancements

- Export database instances ([#132](https://github.com/unjs/db0/pull/132))
- Add `node-sqlite3` connector ([#147](https://github.com/unjs/db0/pull/147))
- Support `RETURNING` clause ([#139](https://github.com/unjs/db0/pull/139))
- **pglite:** Use async init ([#130](https://github.com/unjs/db0/pull/130))

### 🩹 Fixes

- Add missing `mysql` to `connectors` map ([#127](https://github.com/unjs/db0/pull/127))
- Always add `{ success: true }` to select results ([#118](https://github.com/unjs/db0/pull/118))

### 📦 Build

- Generate drivers meta ([#136](https://github.com/unjs/db0/pull/136))
- Field export condition for `libsql` + `web` ([97630f3](https://github.com/unjs/db0/commit/97630f3))

### 🏡 Chore

- Fix typos ([#122](https://github.com/unjs/db0/pull/122))
- Update deps ([00e7454](https://github.com/unjs/db0/commit/00e7454))
- Update deps ([37d2d3c](https://github.com/unjs/db0/commit/37d2d3c))
- Update deps ([d0b5ca8](https://github.com/unjs/db0/commit/d0b5ca8))

### ❤️ Contributors

- Sandro Circi ([@sandros94](http://github.com/sandros94))
- Pooya Parsa ([@pi0](http://github.com/pi0))
- Jonathan Ginn ([@ginnwork](http://github.com/ginnwork))
- Aman Desai ([@amandesai01](http://github.com/amandesai01))
- Farnabaz <farnabaz@gmail.com>
- Hotdogc1017 ([@hotdogc1017](http://github.com/hotdogc1017))
- Nick-w-nick ([@nick-w-nick](http://github.com/nick-w-nick))

## v0.2.1

[compare changes](https://github.com/unjs/db0/compare/v0.2.0...v0.2.1)

### 🩹 Fixes

- **sqlite:** Support `:memory:` ([1a40c4f](https://github.com/unjs/db0/commit/1a40c4f))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.2.0

[compare changes](https://github.com/unjs/db0/compare/v0.1.4...v0.2.0)

### 🚀 Enhancements

- Add `dialect` and planetscale connector ([#59](https://github.com/unjs/db0/pull/59))
- Mysql connector ([#86](https://github.com/unjs/db0/pull/86))
- Support pglite ([#110](https://github.com/unjs/db0/pull/110))

### 🩹 Fixes

- **postgresql:** Use default export ([#63](https://github.com/unjs/db0/pull/63))
- **pkg:** ⚠️  Correct  `/integrations/drizzle` subpath export ([#106](https://github.com/unjs/db0/pull/106))

### 💅 Refactors

- Relax peer dependencies ([a80b62c](https://github.com/unjs/db0/commit/a80b62c))
- **postgresql:** Correct function name ([#114](https://github.com/unjs/db0/pull/114))
- Explicit exports ([f5c30bf](https://github.com/unjs/db0/commit/f5c30bf))

### 📖 Documentation

- **vercel:** Fix the connector name ([#74](https://github.com/unjs/db0/pull/74))
- Fix typo ([#108](https://github.com/unjs/db0/pull/108))
- **sqlite:** Fix pm install component ([#85](https://github.com/unjs/db0/pull/85))
- **guide:** Add information about static parameters ([#80](https://github.com/unjs/db0/pull/80))
- Added jsdocs to exported functions and types ([#89](https://github.com/unjs/db0/pull/89))
- Remove non existent `sql` import ([9e5550f](https://github.com/unjs/db0/commit/9e5550f))

### 🏡 Chore

- Update dependencies ([c7aad11](https://github.com/unjs/db0/commit/c7aad11))
- Update eslint config ([ee1dcbc](https://github.com/unjs/db0/commit/ee1dcbc))
- Apply automated updates ([086317e](https://github.com/unjs/db0/commit/086317e))
- **docs:** Update undocs ([122c83a](https://github.com/unjs/db0/commit/122c83a))
- Update deps ([7e7a4ef](https://github.com/unjs/db0/commit/7e7a4ef))
- Apply automated updates ([5b1bdbd](https://github.com/unjs/db0/commit/5b1bdbd))

### ✅ Tests

- **integrations:** Drizzle integration test ([#79](https://github.com/unjs/db0/pull/79))

#### ⚠️ Breaking Changes

- **pkg:** ⚠️  Correct  `/integrations/drizzle` subpath export ([#106](https://github.com/unjs/db0/pull/106))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Adrien Zaganelli <adrienzaganelli@gmail.com>
- Arash Ari Sheyda ([@arashsheyda](http://github.com/arashsheyda))
- Gerben Mulder <github.undergo381@passmail.net>
- Aman Desai ([@amandesai01](http://github.com/amandesai01))
- Max ([@onmax](http://github.com/onmax))
- Kh ([@hareland](http://github.com/hareland))
- @beer ([@iiio2](http://github.com/iiio2))
- Rishi Raj Jain <rishi18304@iiitd.ac.in>

## v0.1.4

[compare changes](https://github.com/unjs/db0/compare/v0.1.3...v0.1.4)

### 🩹 Fixes

- **d1:** Support `__env__` for accessing binding ([2ef9d57](https://github.com/unjs/db0/commit/2ef9d57))

### 💅 Refactors

- **d1:** Throw a better error if binding not found ([#60](https://github.com/unjs/db0/pull/60))

### 📖 Documentation

- Fix typos ([#56](https://github.com/unjs/db0/pull/56))

### 🏡 Chore

- Apply automated updates ([5760665](https://github.com/unjs/db0/commit/5760665))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Sébastien Chopin <seb@nuxtlabs.com>
- Neil Richter ([@noook](http://github.com/noook))

## v0.1.3

[compare changes](https://github.com/unjs/db0/compare/v0.1.2...v0.1.3)

### 🚀 Enhancements

- Add bun sqlite support ([d6de297](https://github.com/unjs/db0/commit/d6de297))

### 📖 Documentation

- **readme:** Fix links ([#52](https://github.com/unjs/db0/pull/52))

### 🏡 Chore

- Update docs ([598e90c](https://github.com/unjs/db0/commit/598e90c))
- Update docs ([5eda18e](https://github.com/unjs/db0/commit/5eda18e))
- Update readme ([#53](https://github.com/unjs/db0/pull/53))
- Update autofix ci ([ecf97f1](https://github.com/unjs/db0/commit/ecf97f1))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Shoshana Connack

## v0.1.2

[compare changes](https://github.com/unjs/db0/compare/v0.1.1...v0.1.2)

### 🚀 Enhancements

- Add libsql support ([#25](https://github.com/unjs/db0/pull/25))
- Support multiple libsql exports ([#31](https://github.com/unjs/db0/pull/31))
- Support static placeholders with `sql` template ([378fe62](https://github.com/unjs/db0/commit/378fe62))

### 💅 Refactors

- Use `createDatabase` ([84c52d8](https://github.com/unjs/db0/commit/84c52d8))
- Update drizzle integration ([74c909e](https://github.com/unjs/db0/commit/74c909e))

### 📖 Documentation

- Initialize new docs ([c897405](https://github.com/unjs/db0/commit/c897405))

### 🏡 Chore

- Add autofix ci ([32a43e3](https://github.com/unjs/db0/commit/32a43e3))
- Update dependencies ([e3f1828](https://github.com/unjs/db0/commit/e3f1828))
- Format code ([282c286](https://github.com/unjs/db0/commit/282c286))
- Update deps ([6fe166d](https://github.com/unjs/db0/commit/6fe166d))
- Update repo ([269efde](https://github.com/unjs/db0/commit/269efde))
- Update landing ([5fcdb67](https://github.com/unjs/db0/commit/5fcdb67))
- Update landing ([c17fa09](https://github.com/unjs/db0/commit/c17fa09))
- Add npmrc ([859cc05](https://github.com/unjs/db0/commit/859cc05))
- Update readme with automd ([303f138](https://github.com/unjs/db0/commit/303f138))
- Update docs ([ea29f15](https://github.com/unjs/db0/commit/ea29f15))

### 🤖 CI

- Use conventional commit for autofix action ([#34](https://github.com/unjs/db0/pull/34))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Daniel Roe ([@danielroe](http://github.com/danielroe))
- Heb ([@Hebilicious](http://github.com/Hebilicious))

## v0.1.1


### 🚀 Enhancements

  - Add posgresql connector ([51823eb](https://github.com/unjs/db0/commit/51823eb))
  - Support string templates for query ([feea30f](https://github.com/unjs/db0/commit/feea30f))
  - Drizzle integration support ([#17](https://github.com/unjs/db0/pull/17))

### 💅 Refactors

  - Merge `db.query` into `db.sql` ([eef2417](https://github.com/unjs/db0/commit/eef2417))

### 📖 Documentation

  - Add wip notice ([e7a551c](https://github.com/unjs/db0/commit/e7a551c))

### 🏡 Chore

  - Update deps ([0d47eea](https://github.com/unjs/db0/commit/0d47eea))
  - Fix eslintrc ([6c5a07d](https://github.com/unjs/db0/commit/6c5a07d))
  - Initiate docs ([16922ac](https://github.com/unjs/db0/commit/16922ac))
  - Add vercel.json for docs ([3a45877](https://github.com/unjs/db0/commit/3a45877))
  - Rename to `db0` ([61188b4](https://github.com/unjs/db0/commit/61188b4))
  - Prepare for initial release ([459c055](https://github.com/unjs/db0/commit/459c055))
  - Update dependencies ([52da7c2](https://github.com/unjs/db0/commit/52da7c2))

### ❤️  Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

