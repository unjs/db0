import type { Config, Client } from "@libsql/client";
import type { Connector } from "db0";
import {
  importLib,
  lazyInstance,
  type ConnectorDependencies,
  type LibImport,
} from "../_internal/utils.ts";
import libSqlCore from "./core.ts";

export type ConnectorOptions = Config & {
  /**
   * Optionally provide the [`@libsql/client`](https://www.npmjs.com/package/@libsql/client)
   * library (the `@libsql/client/http` entry) to avoid dynamically importing it.
   */
  lib?: LibImport<typeof import("@libsql/client/http")>;
};

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: {
    name: "@libsql/client",
    import: "@libsql/client/http",
    version: "^0.14 || ^0.15 || ^0.16 || ^0.17",
  },
};

const CONNECTOR_NAME = "libsql-web";

export default function libSqlConnector(
  opts: ConnectorOptions,
): Connector<Client> {
  const { lib, ...config } = opts;

  const getClient = lazyInstance(async () => {
    const { createClient } = await importLib(
      CONNECTOR_NAME,
      "@libsql/client/http",
      lib,
      () => import("@libsql/client/http"),
    );
    return createClient(config);
  });

  return libSqlCore({
    name: CONNECTOR_NAME,
    // Every `client.execute()` opens a fresh Hrana stream and closes it in the
    // same request, so `BEGIN`/`COMMIT` sent as separate statements never share
    // a stream. Transactions require `client.transaction()`.
    capabilityOverrides: { transactions: false },
    getClient,
    dispose: async () => {
      const client = await getClient.current;
      getClient.reset();
      client?.close?.();
    },
  });
}
