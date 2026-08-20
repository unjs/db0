import { readFileSync, readdirSync } from "node:fs";
import { defineBuildConfig } from "obuild/config";
import { connectors } from "./src/_connectors.ts";

const connectorEntries = [...new Set(Object.values(connectors))]
  .map((id) => `src/connectors/${id.slice("db0/connectors/".length)}.ts`)
  .sort();

const integrationEntries = readdirSync(
  new URL("src/integrations", import.meta.url),
  { recursive: true },
)
  .map((entry) => String(entry).replaceAll("\\", "/"))
  .filter((entry) => entry.endsWith("index.ts"))
  .map((entry) => `src/integrations/${entry}`)
  .sort();

const input = [
  "src/index.ts",
  "src/capabilities.ts",
  ...connectorEntries,
  ...integrationEntries,
];

validatePkg(input);

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input,
      rolldown: {
        // Keep all bare imports (node builtins and optional peer deps) external
        external: (id) => !/^[.\0/]/.test(id) && !/^[a-zA-Z]:[/\\]/.test(id),
      },
    },
  ],
});

/**
 * Make sure `package.json` is in sync with the build entries: every built file has to be
 * reachable from `exports` (or `main`/`types`) and every declared path has to be built.
 */
function validatePkg(input: string[]): void {
  const pkg = JSON.parse(
    readFileSync(new URL("package.json", import.meta.url), "utf8"),
  ) as Record<string, unknown>;

  const built = new Set(
    input.map(
      (src) => `./${src.replace(/^src\//, "dist/").replace(/\.ts$/, ".mjs")}`,
    ),
  );

  const declared = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === "string") {
      // Types mirror their JS entry, validate both against the same path
      declared.add(value.replace(/\.d\.mts$/, ".mjs"));
    } else if (value && typeof value === "object") {
      for (const child of Object.values(value)) collect(child);
    }
  };
  collect(pkg.exports);
  collect(pkg.main);
  collect(pkg.types);

  const errors: string[] = [];
  const covered = new Set<string>();

  for (const path of declared) {
    const pattern = new RegExp(
      `^${path
        .split("*")
        .map((part) => part.replace(/[$()+.?[\\\]^{|}]/g, "\\$&"))
        .join(".+")}$`,
    );
    const matches = [...built].filter((file) => pattern.test(file));
    if (matches.length === 0) {
      errors.push(`\`${path}\` is declared in package.json but not built`);
    }
    for (const match of matches) covered.add(match);
  }

  for (const file of built) {
    if (!covered.has(file)) {
      errors.push(
        `\`${file}\` is built but not declared in package.json exports`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `package.json is out of sync:\n${errors.map((e) => ` - ${e}`).join("\n")}`,
    );
  }
}
