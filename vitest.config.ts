import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcDirectory = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcDirectory,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
