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
      // todo: maybe make it a queueMicrotask call instead
      Promise.resolve().then(() => {
        scheduled = false;
        callback(...args);
      });
    }
  };
}
