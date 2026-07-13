import type * as pg from "@neondatabase/serverless";
import type { Connector } from "db0";

import { createNeonConnector } from "./_internal/neon.ts";

export type ConnectorOptions = { url?: string } | pg.ClientConfig;

export default function neonConnector(
  opts?: ConnectorOptions,
): Connector<pg.Client> {
  return createNeonConnector("neon", opts);
}
