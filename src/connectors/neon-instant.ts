import type * as pg from "@neondatabase/serverless";
import type { Connector } from "db0";
import type { InstantPostgresParams } from "neon-new";

import {
  createNeonConnector,
  resolveStaticConnectionString,
  type NeonClientOptions,
} from "./_internal/neon.ts";

export type ConnectorOptions = NeonClientOptions &
  Partial<InstantPostgresParams>;

export default function neonInstantConnector(
  opts?: ConnectorOptions,
): Connector<pg.Client> {
  const {
    referrer = "db0/neon-connector",
    dotEnvFile,
    dotEnvKey = "DATABASE_URL",
    seed,
    envPrefix,
    settings,
    ...clientOpts
  } = (opts || {}) as Partial<InstantPostgresParams> & pg.ClientConfig;

  return createNeonConnector("neon-instant", clientOpts, async (clientOpts) => {
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

    const { instantPostgres } = await import("neon-new");

    const { databaseUrl } = await instantPostgres({
      referrer,
      dotEnvFile,
      dotEnvKey,
      seed,
      envPrefix,
      settings,
    });

    return databaseUrl;
  });
}
