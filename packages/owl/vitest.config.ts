import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify("dev"),
    __BUILD_HASH__: JSON.stringify("dev"),
  },
  test: {
    environment: "jsdom",
    root: ".",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/mocks/mockEventTarget.js", "./tests/setup.ts"],
    globals: true,
    testTimeout: 10000,
  },
});
