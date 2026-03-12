import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["dotenv/config"],
    coverage: {
      reporter: ["text", "clover", "json"],
      include: ["src/**/*.ts"],
    },
  },
});
