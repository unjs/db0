import type * as pg from "@neondatabase/serverless";
import type { Connector } from "db0";

import {
  createNeonConnector,
  type NeonClientOptions,
} from "./_internal/neon.ts";
import {
  importLib,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

export type ConnectorOptions = NeonClientOptions & {
  /**
   * Optionally provide the [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless)
   * library to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("@neondatabase/serverless")>;
};

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "@neondatabase/serverless", version: "^1" },
};

const CONNECTOR_NAME = "neon";

export default function neonConnector(
  opts?: ConnectorOptions,
): Connector<pg.Client> {
  const { lib, ...clientOpts } = opts || {};

  return createNeonConnector(CONNECTOR_NAME, clientOpts, () =>
    importLib(
      CONNECTOR_NAME,
      "@neondatabase/serverless",
      lib,
      () => import("@neondatabase/serverless"),
    ),
  );
}
