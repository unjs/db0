import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  declaration: true,
  rollup: {
    emitCJS: true,
  },
  entries: [
    "src/index",
    {
      input: "src/connectors/",
      outDir: "connectors",
      format: "esm",
    },
    {
      input: "src/connectors/",
      outDir: "connectors",
      format: "cjs",
      ext: "cjs",
      declaration: false,
    },
    {
      input: "src/integrations/",
      outDir: "integrations",
      format: "esm",
    },
    {
      input: "src/integrations/",
      outDir: "integrations",
      format: "cjs",
      ext: "cjs",
      declaration: false,
    },
  ],
});
