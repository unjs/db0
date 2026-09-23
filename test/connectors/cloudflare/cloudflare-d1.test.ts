import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { afterAll, beforeAll, describe, vi } from "vitest";
import cloudflareD1 from "../../../src/connectors/cloudflare-d1";
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

describe("connectors: cloudflare-d1", () => {
  let platformProxy: PlatformProxy;

  beforeAll(async () => {
    platformProxy = await getPlatformProxy({
      configPath: fileURLToPath(new URL("wrangler-d1.toml", import.meta.url)),
    });
    cf.env = platformProxy.env;
  });

  afterAll(async () => {
    await platformProxy?.dispose();
    cf.env = undefined;
  });

  testConnector({
    dialect: "sqlite",
    capabilities: { transactions: false },
    connector: cloudflareD1({
      bindingName: "test",
    }),
  });
});
