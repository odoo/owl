import { getScope, isAbortError } from "./scope";
import { effect } from "./effect";
import { signal } from "./signal";

export interface AsyncComputedContext {
  readonly abortSignal: AbortSignal;
}

export interface AsyncComputedOptions<T> {
  initial?: T;
}

export interface AsyncComputed<T> {
  (): T | undefined;
  loading(): boolean;
  error(): Error | null;
  refresh(): void;
  dispose(): void;
}

/**
 * @experimental The exact API is subject to change in future versions.
 */
export function asyncComputed<T>(
  fetcher: (ctx: AsyncComputedContext) => Promise<T>,
  options: AsyncComputedOptions<T> = {}
): AsyncComputed<T> {
  const value = signal<T | undefined>(options.initial);
  const loading = signal(false);
  const error = signal<Error | null>(null);
  const refreshTick = signal(0);

  const scope = getScope();

  let runId = 0;
  let runController: AbortController | null = null;

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

    loading.set(true);
    error.set(null);

    let promise: Promise<T>;
    try {
      promise = fetcher({ abortSignal: AbortSignal.any(abortSignals) });
    } catch (e) {
      if (myRunId !== runId) return;
      if (isAbortError(e)) {
        loading.set(false);
        return;
      }
      error.set(e as Error);
      loading.set(false);
      return;
    }

    promise.then(
      (result) => {
        if (myRunId !== runId) return;
        value.set(result);
        loading.set(false);
      },
      (e) => {
        if (myRunId !== runId) return;
        if (isAbortError(e)) {
          loading.set(false);
          return;
        }
        error.set(e);
        loading.set(false);
      }
    );
  });

  function dispose() {
    stopEffect();
    runController?.abort();
    runController = null;
  }

  scope?.onDestroy(dispose);

  const read = (() => value()) as AsyncComputed<T>;
  read.loading = () => loading();
  read.error = () => error();
  read.refresh = () => refreshTick.set(refreshTick() + 1);
  read.dispose = dispose;
  return read;
}
