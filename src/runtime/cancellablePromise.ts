export type PromiseExecContext = { cancelled: boolean };
export type CancellablePromise<T = any> = Promise<T> & { execContext?: PromiseExecContext };

const OriginalPromise = Promise;
const originalThen = Promise.prototype.then;
let currentCancellablePromise: PromiseExecContext | undefined;
export const setCancellableContext = (ctx: PromiseExecContext | undefined) => {
  const tmpContext = ctx;
  currentCancellablePromise = ctx;
  return tmpContext;
};
export const resetCancellableContext = (ctx: PromiseExecContext | undefined) => {
  currentCancellablePromise = ctx;
};

const ProxyPromise = new Proxy(OriginalPromise, {
  construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget);
    const obj = Object.create(instance);
    obj.execContext = currentCancellablePromise;
    obj.then = proxyThen;
    return obj;
  },
});
const proxyThen = function <T = any>(
  this: CancellablePromise<T>,
  onFulfilled?: (value: T) => any,
  onRejected?: (reason: any) => any
): Promise<any> {
  const ctx = this.execContext;
  return originalThen.call(
    (this as any).__proto__,
    onFulfilled ? (...args: [T]) => _exec(ctx, onFulfilled!, args) : undefined,
    onRejected ? (...args: [any]) => _exec(ctx, onRejected!, args) : undefined
  );
};
export const _exec = (execContext: PromiseExecContext | undefined, cb: Function, args: any[]) => {
  if (execContext?.cancelled) return;
  let tmp = currentCancellablePromise;
  originalThen.call(OriginalPromise.resolve(), () => {
    patchPromise();
    return (currentCancellablePromise = execContext);
  });
  currentCancellablePromise = execContext;
  const result = cb(...args);
  originalThen.call(OriginalPromise.resolve(), () => {
    restorePromise();
    return (currentCancellablePromise = tmp);
  });
  return result;
};

export function patchPromise() {
  window.Promise = ProxyPromise;
}
export function restorePromise() {
  window.Promise = OriginalPromise;
}

export function getCancellableTask(cb: Function) {
  const context: PromiseExecContext = { cancelled: false };
  const tmp = setCancellableContext(context);
  patchPromise();
  cb();
  restorePromise();
  resetCancellableContext(tmp);

  return {
    cancel: () => (context.cancelled = true),
    get isCancel() {
      return context.cancelled;
    },
  };
}
