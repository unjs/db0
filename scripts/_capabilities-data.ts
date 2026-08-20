import { dialectCapabilities, getCapabilities } from "../src/capabilities.ts";
import type { ConnectorName } from "../src/_connectors.ts";
import type { DatabaseCapabilities } from "../src/types.ts";

/**
 * Capabilities of every connector, mirroring its `dialect` and `capabilityOverrides`.
 *
 * Typed as an exhaustive `Record<ConnectorName, ...>` so that `pnpm test:types`
 * fails when a connector is added without a row here. The *values* are checked
 * against the real connectors by `test/connector-capabilities.test.ts`, which
 * imports each one and compares — keep both in mind when editing.
 */
export const connectorCapabilities: Record<
  ConnectorName,
  DatabaseCapabilities
> = {
  "better-sqlite3": dialectCapabilities.sqlite,
  sqlite3: dialectCapabilities.sqlite,
  "bun-sqlite": dialectCapabilities.sqlite,
  bun: dialectCapabilities.sqlite,
  "node-sqlite": dialectCapabilities.sqlite,
  sqlite: dialectCapabilities.sqlite,
  "libsql-core": dialectCapabilities.libsql,
  "libsql-node": dialectCapabilities.libsql,
  libsql: dialectCapabilities.libsql,
  "libsql-http": getCapabilities("libsql", { supportsTransactions: false }),
  "libsql-web": getCapabilities("libsql", { supportsTransactions: false }),
  "cloudflare-d1": getCapabilities("sqlite", { supportsTransactions: false }),
  postgresql: dialectCapabilities.postgresql,
  pglite: dialectCapabilities.postgresql,
  neon: dialectCapabilities.postgresql,
  "cloudflare-hyperdrive-postgresql": dialectCapabilities.postgresql,
  mysql2: dialectCapabilities.mysql,
  planetscale: getCapabilities("mysql", { supportsTransactions: false }),
  "cloudflare-hyperdrive-mysql": dialectCapabilities.mysql,
};

export const capabilityLabels: Record<keyof DatabaseCapabilities, string> = {
  supportsJSON: "JSON",
  supportsBooleans: "Bool",
  supportsArrays: "Array",
  supportsDates: "Date",
  supportsUUIDs: "UUID",
  supportsTransactions: "Tx",
};
