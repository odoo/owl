import { Equals } from "./computations";
import { getScope, isAbortError } from "./scope";
import { effect } from "./effect";
import { signal } from "./signal";

export interface AsyncComputedContext {
  readonly abortSignal: AbortSignal;
}

export interface AsyncComputedOptions<T> {
  initial?: T;
  /**
   * Custom equality for the resolved value (see Equals): a fetch resolving to
   * an equal value does not notify observers. Note that the previous value is
   * `undefined` before the first resolution when no `initial` is given.
   */
  equals?: Equals<T | undefined>;
}

export interface AsyncComputed<T> {
  (): T | undefined;
  loading(): boolean;
  error(): Error | null;
  refresh(): void;
  dispose(): void;
  /**
   * Returns a promise that resolves as soon as no run is in flight: if a run
   * is currently running it resolves once that run (or any run that supersedes
   * it) settles, otherwise it resolves immediately. It never rejects — fetcher
   * errors are surfaced through `error()`. Handy to await the value in
   * `onWillStart`: `onWillStart(() => data.currentPromise())`.
   */
  currentPromise(): Promise<void>;
}

/**
 * @experimental The exact API is subject to change in future versions.
 */
export function asyncComputed<T>(
  fetcher: (ctx: AsyncComputedContext) => Promise<T>,
  options: AsyncComputedOptions<T> = {}
): AsyncComputed<T> {
  const value = signal<T | undefined>(options.initial, { equals: options.equals });
  const loading = signal(false);
  const error = signal<Error | null>(null);
  const refreshTick = signal(0);

  const scope = getScope();

  let runId = 0;
  let runController: AbortController | null = null;

  // Whether a run is currently in flight. Mirrors `loading`, but as a plain
  // (non-reactive) flag: `currentPromise()` can read it without registering a
  // dependency, and `dispose()` can mark the run abandoned without writing to
  // the reactive `loading` signal.
  let inFlight = false;
  // Deferred handed out by `currentPromise()`, created lazily — only when a
  // caller actually asks for it while a run is in flight. Resolved when the run
  // settles; a re-run that supersedes an in-flight run keeps the same deferred,
  // so it resolves only once the latest run is no longer in flight. It never
  // rejects: errors are surfaced through `error()`.
  let pending: { promise: Promise<void>; resolve: () => void } | null = null;

  function beginRun() {
    loading.set(true);
    inFlight = true;
  }

  // Settles the current run. Must not read a signal — it also runs on the
  // synchronous path of the effect (the fetcher throwing), where a read would
  // register as a spurious dependency.
  function endRun() {
    loading.set(false);
    inFlight = false;
    pending?.resolve();
    pending = null;
  }

  const stopEffect = effect(() => {
    refreshTick();
    const myRunId = ++runId;

    if (runController) {
      runController.abort();
    }
    const controller = new AbortController();
    runController = controller;

    const abortSignals = [controller.signal];
    if (scope?.abortSignal) {
      abortSignals.push(scope.abortSignal);
    }

    beginRun();
    error.set(null);

    let promise: Promise<T>;
    try {
      promise = fetcher({ abortSignal: AbortSignal.any(abortSignals) });
    } catch (e) {
      if (myRunId !== runId) return;
      if (isAbortError(e)) {
        endRun();
        return;
      }
      error.set(e as Error);
      endRun();
      return;
    }

    promise.then(
      (result) => {
        if (myRunId !== runId) return;
        value.set(result);
        endRun();
      },
      (e) => {
        if (myRunId !== runId) return;
        if (isAbortError(e)) {
          endRun();
          return;
        }
        error.set(e);
        endRun();
      }
    );
  });

  function dispose() {
    runId++;
    stopEffect();
    runController?.abort();
    runController = null;
    // Mark the abandoned run as no longer in flight and release any awaiter.
    inFlight = false;
    pending?.resolve();
    pending = null;
  }

  scope?.onDestroy(dispose);

  const read = (() => value()) as AsyncComputed<T>;
  read.loading = () => loading();
  read.error = () => error();
  read.refresh = () => refreshTick.set(refreshTick() + 1);
  read.dispose = dispose;
  read.currentPromise = () => {
    if (!inFlight) {
      return Promise.resolve();
    }
    if (!pending) {
      let resolve!: () => void;
      pending = { promise: new Promise<void>((res) => (resolve = res)), resolve };
    }
    return pending.promise;
  };
  return read;
}
