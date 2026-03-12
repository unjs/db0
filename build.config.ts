import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    { type: "bundle", input: "src/index.ts" },
    { type: "transform", input: "src/connectors/", outDir: "dist/connectors" },
    {
      type: "transform",
      input: "src/integrations/",
      outDir: "dist/integrations",
    },
  ],
});
