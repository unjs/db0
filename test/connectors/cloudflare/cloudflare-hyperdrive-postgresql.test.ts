import { getPlatformProxy, type PlatformProxy } from "wrangler";

import { afterAll, beforeAll, describe, vi } from "vitest";
import cloudflareHyperdrivePostgresql from "../../../src/connectors/cloudflare-hyperdrive-postgresql";
import { testConnector } from "../_tests";
import { fileURLToPath } from "node:url";

const cf = vi.hoisted(() => ({
  env: undefined as Record<string, unknown> | undefined,
}));
vi.mock("cloudflare:workers", () => ({
  get env() {
    return cf.env;
  },
}));

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
      cf.env = platformProxy.env;
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
