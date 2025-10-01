import { getPlatformProxy, type PlatformProxy } from "wrangler";

import { afterAll, beforeAll, describe } from "vitest";
import cloudflareHyperdrivePostgresql from "../../../src/connectors/cloudflare-hyperdrive-postgresql";
import { testConnector } from "../_tests";
import { fileURLToPath } from "node:url";

describe.runIf(process.env.POSTGRESQL_URL)(
  "connectors: cloudflare-hyperdrive-postgresql",
  () => {
    let platformProxy: PlatformProxy;

    beforeAll(async () => {
      process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_POSTGRESQL =
        process.env.POSTGRESQL_URL;
      platformProxy = await getPlatformProxy({
        configPath: fileURLToPath(new URL("wrangler-pg.toml", import.meta.url)),
      });
      (globalThis as any).__env__ = platformProxy.env;
    });

    afterAll(async () => {
      await platformProxy?.dispose();
    });

    testConnector({
      dialect: "postgresql",
      connector: cloudflareHyperdrivePostgresql({
        bindingName: "POSTGRESQL",
      }),
    });
  },
);
