import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe } from "vitest";
import cloudflareD1 from "../../src/connectors/cloudflare-d1";
import { testConnector } from "./_tests";
import { fileURLToPath } from "node:url";

describe("connectors: cloudflare-d1", () => {
  let platformProxy: PlatformProxy;

  beforeAll(async () => {
    platformProxy = await getPlatformProxy({
      configPath: fileURLToPath(new URL("wrangler.toml", import.meta.url)),
    });
    globalThis.__env__ = platformProxy.env;
  });

  afterAll(async () => {
    await platformProxy?.dispose();
    globalThis.__env__ = undefined;
  });

  testConnector({
    dialect: "sqlite",
    connector: cloudflareD1({
      bindingName: "test",
    }),
  });
});
