type Callback = (...args: any[]) => void;

/**
 * Creates a batched version of a callback so that all calls to it in the same
 * tick only call the original callback once. Defaults to a microtask schedule;
 * pass a custom schedule (e.g. `setTimeout`) for macrotask batching.
 *
 * @param callback the callback to batch
 * @param schedule how to defer the flush (default: `queueMicrotask`)
 * @returns a batched version of the original callback
 */
export function batched(
  callback: Callback,
  schedule: (cb: () => void) => void = queueMicrotask
): Callback {
  let scheduled = false;
  return function batchedCall(...args) {
    if (!scheduled) {
      scheduled = true;
      schedule(() => {
        scheduled = false;
        callback(...args);
      });
    }
  };
}
