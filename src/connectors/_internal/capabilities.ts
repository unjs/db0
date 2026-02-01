import { dialectCapabilities } from "../../capabilities.ts";
import type { DatabaseCapabilities } from "../../types.ts";

// Connector-to-capabilities mapping for documentation generation
export const connectorCapabilities: Record<string, DatabaseCapabilities> = {
  "better-sqlite3": dialectCapabilities.sqlite,
  sqlite3: dialectCapabilities.sqlite,
  "bun-sqlite": dialectCapabilities.sqlite,
  "node-sqlite": dialectCapabilities.sqlite,
  libsql: dialectCapabilities.libsql,
  "cloudflare-d1": dialectCapabilities.sqlite,
  postgresql: dialectCapabilities.postgresql,
  pglite: dialectCapabilities.postgresql,
  "cloudflare-hyperdrive-postgresql": dialectCapabilities.postgresql,
  mysql2: dialectCapabilities.mysql,
  planetscale: dialectCapabilities.mysql,
  "cloudflare-hyperdrive-mysql": dialectCapabilities.mysql,
};
