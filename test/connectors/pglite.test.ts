import { fileURLToPath } from "node:url";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe } from "vitest";
import PGlite from "../../src/connectors/pglite"
import { testConnector } from "./_tests";

describe("connectors: pglite", () => {
  const dbPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    ".tmp/pglite/.data/pglite-data",
  );
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
  mkdirSync(dirname(dbPath), { recursive: true });
  testConnector({
    connector: PGlite({
      dataDir: `${dbPath}`,
    }),
  });
});
