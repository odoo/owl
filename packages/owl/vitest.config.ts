import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify("dev"),
    __BUILD_HASH__: JSON.stringify("dev"),
  },
  resolve: {
    alias: {
      "@odoo/owl-core": fileURLToPath(
        new URL("../owl-core/src/index.ts", import.meta.url)
      ),
      "@odoo/owl-compiler": fileURLToPath(
        new URL("../owl-compiler/src/index.ts", import.meta.url)
      ),
      "@odoo/owl-runtime": fileURLToPath(
        new URL("../owl-runtime/src/index.ts", import.meta.url)
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
