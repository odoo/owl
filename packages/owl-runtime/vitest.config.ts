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
      "@odoo/owl-compiler/src/parser": fileURLToPath(
        new URL("../owl-compiler/src/parser.ts", import.meta.url)
      ),
      "@odoo/owl-compiler/src/inline_expressions": fileURLToPath(
        new URL("../owl-compiler/src/inline_expressions.ts", import.meta.url)
      ),
      "@odoo/owl-compiler": fileURLToPath(
        new URL("../owl-compiler/src/index.ts", import.meta.url)
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
