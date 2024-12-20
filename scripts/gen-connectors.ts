import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { findTypeExports } from "mlly";
import { camelCase, upperFirst } from "scule";

const connectorsDir = fileURLToPath(new URL("../src/connectors", import.meta.url));

const connectorsMetaFile = fileURLToPath(
  new URL("../src/_connectors.ts", import.meta.url)
);

async function getConnectorFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...await getConnectorFiles(join(dir, entry.name)));
    } else if (entry.isFile()) {
      files.push(join(dir, entry.name));
    }
  }

  return files;
}

const connectorFiles = await getConnectorFiles(connectorsDir);
const connectorEntries = connectorFiles.map((file) => file.replace(connectorsDir + "/", ""));

const connectors: {
  name: string;
  safeName: string;
  names: string[];
  subpath: string;
  optionsTExport?: string;
  optionsTName?: string;
}[] = [];

for (const entry of connectorEntries) {
  const pathName = entry.replace(/\.ts$/, "");
  const name = pathName.replace(/\/|\\/g, "-");
  const subpath = `db0/connectors/${pathName}`;
  const fullPath = join(connectorsDir, `${pathName}.ts`);

  const contents = await readFile(fullPath, "utf8");
  const optionsTExport = findTypeExports(contents).find((type) =>
    type.name?.endsWith("Options")
  )?.name;

  const safeName = camelCase(name)
    .replace(/db/i, "DB")
    .replace("bunSqlite", "bun")
    .replace("libsqlNode", "libsql");

  const names = [...new Set([name, safeName])];

  const optionsTName = upperFirst(safeName) + "Options";

  connectors.push({
    name,
    safeName,
    names,
    subpath,
    optionsTExport,
    optionsTName,
  });
}

const genCode = /* ts */ `// Auto-generated using scripts/gen-connectors.
// Do not manually edit!
${connectors
  .filter((d) => d.optionsTExport)
  .map(
    (d) =>
      /* ts */ `import type { ${d.optionsTExport} as ${d.optionsTName} } from "${d.subpath}";`
  )
  .join("\n")}
export type BuiltinConnectorName = ${connectors.flatMap((d) => d.names.map((name) => `"${name}"`)).join(" | ")};
export type BuiltinConnectorOptions = {
  ${connectors
    .filter((d) => d.optionsTExport)
    .flatMap((d) => d.names.map((name) => `"${name}": ${d.optionsTName};`))
    .join("\n  ")}
};
export const builtinConnectors = {
  ${connectors.flatMap((d) => d.names.map((name) => `"${name}": "${d.subpath}"`)).join(",\n  ")},
} as const;
`;

await writeFile(connectorsMetaFile, genCode, "utf8");
console.log("Generated connectors metadata file to", connectorsMetaFile);
