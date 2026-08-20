import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectorDependencies } from "../src/_connectors";
import type { ConnectorName } from "../src/_connectors";

const connectorsDir = fileURLToPath(
  new URL("../src/connectors", import.meta.url),
);

const connectorFiles = (
  await readdir(connectorsDir, { recursive: true, withFileTypes: true })
)
  .filter((entry) => entry.isFile() && !entry.name.startsWith("_"))
  .map((entry) =>
    join(entry.parentPath, entry.name)
      .slice(connectorsDir.length + 1)
      .replaceAll("\\", "/"),
  )
  .filter((file) => !file.split("/").some((part) => part.startsWith("_")));

/** `mysql2/promise` -> `mysql2`, `@libsql/client/http` -> `@libsql/client` */
function packageName(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0]!;
}

/** `opts.lib` / `opts?.lib` / `lib` -> `lib` */
function optionName(expression: string): string {
  return expression.split(".").pop()!.replace("?", "");
}

describe("connector dependencies", () => {
  for (const file of connectorFiles) {
    const name = file.replace(/\.ts$/, "").replaceAll("/", "-");

    it(name, async () => {
      const contents = await readFile(join(connectorsDir, file), "utf8");
      const declared = connectorDependencies[name as ConnectorName] || {};

      const expected: Record<string, string> = {};
      for (const [, specifier, expression] of contents.matchAll(
        /importLib\(\s*CONNECTOR_NAME,\s*"([^"]+)",\s*([\w.?]+),/g,
      )) {
        expected[optionName(expression!)] = packageName(specifier!);
      }

      expect(
        Object.fromEntries(
          Object.entries(declared).map(([option, dep]) => [option, dep.name]),
        ),
      ).toEqual(expected);

      for (const dep of Object.values(declared)) {
        expect(dep.version, `${name}: missing version range`).toBeTruthy();
      }
    });
  }

  it("aliases share the same dependencies", () => {
    expect(connectorDependencies["libsql"]).toEqual(
      connectorDependencies["libsql-node"],
    );
  });
});
