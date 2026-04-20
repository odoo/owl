import { getScope, isAbortError } from "../scope";
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
  const scopeAbortSignal = scope?.abortSignal ?? null;

  let runId = 0;
  let runController: AbortController | null = null;
  let scopeAbortListener: (() => void) | null = null;

  function detachScopeListener() {
    if (scopeAbortSignal && scopeAbortListener) {
      scopeAbortSignal.removeEventListener("abort", scopeAbortListener);
      scopeAbortListener = null;
    }
  }

  const stopEffect = effect(() => {
    refreshTick();
    const myRunId = ++runId;

    if (runController) {
      runController.abort();
      detachScopeListener();
    }
    const controller = new AbortController();
    runController = controller;

    if (scopeAbortSignal) {
      if (scopeAbortSignal.aborted) {
        controller.abort();
      } else {
        scopeAbortListener = () => controller.abort();
        scopeAbortSignal.addEventListener("abort", scopeAbortListener, { once: true });
      }
    }

    loading.set(true);
    error.set(null);

    let promise: Promise<T>;
    try {
      promise = fetcher({ abortSignal: controller.signal });
    } catch (e) {
      if (myRunId !== runId) return;
      detachScopeListener();
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
        detachScopeListener();
        value.set(result);
        loading.set(false);
      },
      (e) => {
        if (myRunId !== runId) return;
        detachScopeListener();
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
    detachScopeListener();
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
