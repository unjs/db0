import { fileURLToPath } from "node:url";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe } from "vitest";
import libSql from "../../src/connectors/libsql/node";
import { testConnector } from "./_tests";

describe("connectors: libsql", () => {
  const dbPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    ".tmp/libsql/.data/local.db",
  );
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
  mkdirSync(dirname(dbPath), { recursive: true });
  testConnector({
    dialect: "libsql",
    connector: libSql({
      url: `file:${dbPath}`,
    }),
  });
});
