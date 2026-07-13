import type * as pg from "@neondatabase/serverless";
import type { Connector } from "db0";
import { instantPostgres, type InstantPostgresParams } from "neon-new";

import {
  createNeonConnector,
  resolveStaticConnectionString,
} from "./_internal/neon.ts";

export type ConnectorOptions = ({ url?: string } | pg.ClientConfig) &
  Partial<InstantPostgresParams>;

export default function neonInstantConnector(
  opts?: ConnectorOptions,
): Connector<pg.Client> {
  const {
    referrer = "db0/neon-connector",
    dotEnvFile,
    dotEnvKey,
    seed,
    envPrefix,
    settings,
  } = opts || {};

  return createNeonConnector("neon-instant", opts, async (clientOpts) => {
    const connectionString = resolveStaticConnectionString(clientOpts);
    if (connectionString) {
      return connectionString;
    }

    // Provisioning a claimable database is a development-time affordance.
    if (process.env.NODE_ENV === "production") {
      return undefined;
    }

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
