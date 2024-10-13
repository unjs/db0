# Changelog


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

