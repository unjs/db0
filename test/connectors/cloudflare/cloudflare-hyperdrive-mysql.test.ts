import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, vi } from "vitest";
import cloudflareHyperdriveMysql from "../../../src/connectors/cloudflare-hyperdrive-mysql";
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

describe.runIf(process.env.MYSQL_URL)(
  "connectors: cloudflare-hyperdrive-mysql",
  () => {
    let platformProxy: PlatformProxy;

    beforeAll(async () => {
      process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_MYSQL =
        process.env.MYSQL_URL;
      platformProxy = await getPlatformProxy({
        configPath: fileURLToPath(
          new URL("wrangler-mysql.toml", import.meta.url),
        ),
      });
      cf.env = platformProxy.env;
    });

    afterAll(async () => {
      await platformProxy?.dispose();
      cf.env = undefined;
    });

    testConnector({
      dialect: "mysql",
      connector: cloudflareHyperdriveMysql({
        bindingName: "MYSQL",
      }),
    });
  },
);
