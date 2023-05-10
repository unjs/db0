import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import { describe } from "vitest";
import connector from "../../src/connectors/better-sqlite3";
import { testConnector } from "./_tests";

describe("connectors: better-sqlite3", () => {
  const tmpDir = fileURLToPath(new URL(".tmp/better-sqlite3", import.meta.url));
  rmSync(tmpDir, { recursive: true, force: true });
  testConnector({
    connector: connector({
      cwd: tmpDir,
    }),
  });
});
