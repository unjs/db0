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

/**
 * `bun-sqlite` statically imports `bun:sqlite`, which cannot be resolved under Node,
 * so its module (and therefore its `CONNECTOR_DEPENDENCIES` export) cannot be loaded here.
 */
const NOT_LOADABLE_IN_NODE = new Set(["bun-sqlite"]);

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

      const expected: Record<string, { name: string; import?: string }> = {};
      for (const [, specifier, expression, loaded] of contents.matchAll(
        /importLib\(\s*CONNECTOR_NAME,\s*"([^"]+)",\s*([\w.?]+),\s*\(\)\s*=>\s*import\("([^"]+)"\)/g,
      )) {
        expect(
          loaded,
          `${name}: dynamic import does not match the declared specifier`,
        ).toBe(specifier);
        const pkg = packageName(specifier!);
        expected[optionName(expression!)] = {
          name: pkg,
          // Only declared when the connector imports a subpath of the package.
          import: specifier === pkg ? undefined : specifier,
        };
      }

      expect(
        Object.fromEntries(
          Object.entries(declared).map(([option, dep]) => [
            option,
            { name: dep.name, import: dep.import },
          ]),
        ),
      ).toEqual(expected);

      for (const dep of Object.values(declared)) {
        expect(dep.version, `${name}: missing version range`).toBeTruthy();
      }

      if (NOT_LOADABLE_IN_NODE.has(name)) {
        return;
      }

      // The generated map is a copy of the connector's own export: they must not drift.
      const specifier = `../src/connectors/${file}`;
      const { CONNECTOR_DEPENDENCIES: exported } = await import(specifier);
      expect(
        exported ?? {},
        `${name}: generated map is out of sync with CONNECTOR_DEPENDENCIES`,
      ).toEqual(declared);
    });
  }

  it("aliases share the same dependencies", () => {
    expect(connectorDependencies["libsql"]).toEqual(
      connectorDependencies["libsql-node"],
    );
  });
});
