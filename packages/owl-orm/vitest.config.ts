import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    root: ".",
    include: ["tests/**/*.test.ts"],
    globals: true,
    testTimeout: 10000,
  },
});
