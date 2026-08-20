import { readFile, readdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join, resolve } from "pathe";
import { findTypeExports } from "mlly";
import { camelCase, upperFirst } from "scule";
import type { ConnectorDependencies } from "../src/types.ts";

const connectorsDir = resolve(import.meta.dirname, "../src/connectors");

const connectorsMetaFile = resolve(
  import.meta.dirname,
  "../src/_connectors.ts",
);

const aliases = {
  "node-sqlite": ["sqlite"],
  "bun-sqlite": ["bun"],
  "libsql-node": ["libsql"],
} as const;

async function getConnectorFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith("_")) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await getConnectorFiles(join(dir, entry.name))));
    } else if (entry.isFile()) {
      files.push(join(dir, entry.name));
    }
  }

  return files;
}

const connectorFiles = await getConnectorFiles(connectorsDir);
const connectorEntries = connectorFiles.map((file) =>
  file.slice(connectorsDir.length + 1),
);

const connectors: {
  name: string;
  safeName: string;
  names: string[];
  subpath: string;
  optionsTExport?: string;
  optionsTName?: string;
  dependencies?: ConnectorDependencies;
}[] = [];

for (const entry of connectorEntries) {
  const pathName = entry.replace(/\.ts$/, "");
  const name = pathName.replace(/[/\\]/g, "-");
  const subpath = `db0/connectors/${pathName}`;
  const fullPath = join(connectorsDir, `${pathName}.ts`);

  const contents = await readFile(fullPath, "utf8");
  const optionsTExport = findTypeExports(contents).find((type) =>
    type.name?.endsWith("Options"),
  )?.name;

  const safeName = camelCase(name).replace(/db/i, "DB").replace(/sql/i, "SQL");

  const alternativeNames: readonly string[] =
    aliases[name as keyof typeof aliases] || [];

  const names = [...new Set([name, ...alternativeNames])];

  const optionsTName = upperFirst(safeName) + "Options";

  // Connectors only import their third-party libraries dynamically, so this is safe to load.
  const { CONNECTOR_DEPENDENCIES: dependencies } = contents.includes(
    "CONNECTOR_DEPENDENCIES",
  )
    ? await import(pathToFileURL(fullPath).href)
    : { CONNECTOR_DEPENDENCIES: undefined };

  connectors.push({
    name,
    safeName,
    names,
    subpath,
    optionsTExport,
    optionsTName,
    dependencies,
  });
}

connectors.sort((a, b) => a.name.localeCompare(b.name));

const genCode = /* ts */ `// Auto-generated using scripts/gen-connectors.
// Do not manually edit!
import type { ConnectorDependencies } from "./types.ts";
${connectors
  .filter((d) => d.optionsTExport)
  .map(
    (d) =>
      /* ts */ `import type { ${d.optionsTExport} as ${d.optionsTName} } from "${d.subpath}";`,
  )
  .join("\n")}

export type ConnectorName = ${connectors.flatMap((d) => d.names.map((name) => `"${name}"`)).join(" | ")};

export type ConnectorOptions = {
  ${connectors
    .filter((d) => d.optionsTExport)
    .flatMap((d) =>
      d.names.map(
        (name, i) =>
          `${i === 0 ? "" : `/** alias of ${d.name} */\n  `}"${name}": ${d.optionsTName};`,
      ),
    )
    .join("\n  ")}
};

export const connectors: Record<ConnectorName, string> = Object.freeze({
  ${connectors.flatMap((d) => d.names.map((name, i) => `${i === 0 ? "" : `/** alias of ${d.name} */\n  `}"${name}": "${d.subpath}"`)).join(",\n  ")},
} as const);

/**
 * Third-party packages each connector dynamically imports, keyed by the connector option
 * that can be used to provide them (usually \`lib\`).
 *
 * Connectors not listed here have no third-party dependencies.
 */
export const connectorDependencies: Partial<
  Record<ConnectorName, ConnectorDependencies>
> = Object.freeze({
  ${connectors
    .filter((d) => d.dependencies)
    .flatMap((d) =>
      d.names.map(
        (name, i) =>
          `${i === 0 ? "" : `/** alias of ${d.name} */\n  `}"${name}": {\n    ${Object.entries(
            d.dependencies!,
          )
            .map(
              ([option, dep]) =>
                `${option}: { name: "${dep.name}", version: "${dep.version}"${dep.optional ? ", optional: true" : ""} },`,
            )
            .join("\n    ")}\n  }`,
      ),
    )
    .join(",\n  ")},
} as const);
`;

await writeFile(connectorsMetaFile, genCode, "utf8");
console.log("Generated connectors metadata file to", connectorsMetaFile);
