type Callback = (...args: any[]) => void;

/**
 * Creates a batched version of a callback so that all calls to it in the same
 * microtick will only call the original callback once.
 *
 * @param callback the callback to batch
 * @returns a batched version of the original callback
 */
export function batched(callback: Callback): Callback {
  let scheduled = false;
  return function batchedCall(...args) {
    if (!scheduled) {
      scheduled = true;
      // Intentionally Promise-based: errors thrown by `callback` surface as
      // unhandled promise rejections, which vitest's `onUnhandledError` hook
      // intercepts (see tests/effect.test.ts using `IntentionalTestError`).
      // Switching to `queueMicrotask` routes errors through a different
      // uncaught-exception channel and complicates the debugging workflow.
      Promise.resolve().then(() => {
        scheduled = false;
        callback(...args);
      });
    }
  };
}
