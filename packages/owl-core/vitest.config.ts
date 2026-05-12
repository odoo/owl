import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    root: ".",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    testTimeout: 10000,
    // Some reactivity tests intentionally let an effect's throw propagate
    // through batched()'s .then() chain to exercise queue-state invariants
    // in processEffects. Those rejections are tagged via an
    // IntentionalTestError class so we can filter them here without blanket-
    // silencing every unhandled error in the suite.
    onUnhandledError(error) {
      if (error.name === "IntentionalTestError") {
        return false;
      }
    },
  },
});
