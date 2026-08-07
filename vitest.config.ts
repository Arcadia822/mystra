import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "lcov"],
    },
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "app/**/*.test.ts",
      "apps/**/*.test.ts",
      "packages/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
  },
});
