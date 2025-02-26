import { defineBuildConfig } from "unbuild";
import { rm } from "node:fs/promises";

export default defineBuildConfig({
  declaration: true,
  entries: [
    "src/index",
    { input: "src/connectors/", outDir: "dist/connectors" },
    { input: "src/integrations/", outDir: "dist/integrations" },
  ],
  hooks: {
    async "build:done"() {
      await rm("dist/index.d.ts");
    },
  },
});
