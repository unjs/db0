import type * as pg from "@neondatabase/serverless";
import type { Connector } from "db0";
import type { InstantPostgresParams } from "neon-new";

import {
  createNeonConnector,
  resolveStaticConnectionString,
  type NeonClientOptions,
} from "./_internal/neon.ts";
import {
  importLib,
  type ConnectorDependencies,
  type LibImport,
} from "./_internal/utils.ts";

export type ConnectorOptions = NeonClientOptions &
  Partial<InstantPostgresParams> & {
    /**
     * Optionally provide the [`@neondatabase/serverless`](https://www.npmjs.com/package/@neondatabase/serverless)
     * library to avoid dynamically importing it.
     */
    lib?: LibImport<typeof import("@neondatabase/serverless")>;

    /**
     * Optionally provide the [`neon-new`](https://www.npmjs.com/package/neon-new) library
     * to avoid dynamically importing it. Only used when a database has to be provisioned.
     */
    provisionLib?: LibImport<typeof import("neon-new")>;
  };

export const CONNECTOR_DEPENDENCIES: ConnectorDependencies = {
  lib: { name: "@neondatabase/serverless", version: "^1" },
  provisionLib: { name: "neon-new", version: "^0.15", optional: true },
};

const CONNECTOR_NAME = "neon-instant";

export default function neonInstantConnector(
  opts?: ConnectorOptions,
): Connector<pg.Client> {
  const {
    lib,
    provisionLib,
    referrer = "db0/neon-connector",
    dotEnvFile,
    dotEnvKey = "DATABASE_URL",
    seed,
    envPrefix,
    settings,
    ...clientOpts
  } = (opts || {}) as ConnectorOptions & pg.ClientConfig;

  return createNeonConnector(
    CONNECTOR_NAME,
    clientOpts,
    () =>
      importLib(
        CONNECTOR_NAME,
        "@neondatabase/serverless",
        lib,
        () => import("@neondatabase/serverless"),
      ),
    async (clientOpts) => {
      const connectionString = resolveStaticConnectionString(clientOpts);
      if (connectionString) {
        return connectionString;
      }

      // Reuse the database provisioned by an earlier run, if it is still around.
      const fromEnv = globalThis.process?.env?.[dotEnvKey];
      if (fromEnv) {
        return fromEnv;
      }

      // Provisioning a claimable database is a development-time affordance.
      if (globalThis.process?.env?.NODE_ENV === "production") {
        throw new Error(
          "[db0] [neon-instant] Refusing to provision a database in production. Pass a connection string, or use the `neon` connector.",
        );
      }

      const { instantPostgres } = await importLib(
        CONNECTOR_NAME,
        "neon-new",
        provisionLib,
        () => import("neon-new"),
      );

      const { databaseUrl } = await instantPostgres({
        referrer,
        dotEnvFile,
        dotEnvKey,
        seed,
        envPrefix,
        settings,
      });

      return databaseUrl;
    },
  );
}
