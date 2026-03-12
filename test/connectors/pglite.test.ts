import { fileURLToPath } from "node:url";
import { rm, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe } from "vitest";
import PGlite from "../../src/connectors/pglite";
import { testConnector } from "./_tests";

describe("connectors: pglite", async () => {
  const dataDir = fileURLToPath(new URL(".tmp/pglite", import.meta.url));
  await rm(dataDir, { recursive: true }).catch(() => {
    /* */
  });
  await mkdir(dirname(dataDir), { recursive: true });
  testConnector({
    dialect: "postgresql",
    connector: PGlite({ dataDir }),
  });
});
