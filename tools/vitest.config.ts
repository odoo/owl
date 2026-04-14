import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tools/**/*.test.ts"],
    globals: true,
  },
});
