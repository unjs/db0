import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe } from "vitest";
import cloudflareHyperdriveMysql from "../../src/connectors/cloudflare-hyperdrive-mysql";
import { testConnector } from "./_tests";
import { fileURLToPath } from "node:url";

describe("connectors: cloudflare-hyperdrive-mysql", () => {
  let platformProxy: PlatformProxy;

  beforeAll(async () => {
    platformProxy = await getPlatformProxy({
      configPath: fileURLToPath(new URL("wrangler.toml", import.meta.url)),
    })
    globalThis.__env__ = platformProxy.env
  })

  afterAll(async () => {
    await platformProxy?.dispose()
    globalThis.__env__ = undefined
  })

  testConnector({
    dialect: "mysql",
    connector: cloudflareHyperdriveMysql({
      bindingName: 'MYSQL',
    }),
  });
});
