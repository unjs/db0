import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe } from "vitest";
import cloudflareHyperdriveMysql from "../../../src/connectors/cloudflare-hyperdrive-mysql";
import { testConnector } from "../_tests";
import { fileURLToPath } from "node:url";

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
      (globalThis as any).__env__ = platformProxy.env;
    });

    afterAll(async () => {
      await platformProxy?.dispose();
      (globalThis as any).__env__ = undefined;
    });

    testConnector({
      dialect: "mysql",
      connector: cloudflareHyperdriveMysql({
        bindingName: "MYSQL",
      }),
    });
  },
);
