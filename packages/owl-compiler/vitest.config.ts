import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@odoo/owl-core": fileURLToPath(
        new URL("../owl-core/src/index.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "jsdom",
    root: ".",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10000,
  },
});
