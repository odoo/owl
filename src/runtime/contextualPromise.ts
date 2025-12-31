import { CancellablePromise, PromiseContext, Task } from "../common/types";

export function makeTask(
  cb: Function,
  onRestoreContext?: PromiseContext["onRestoreContext"],
  onCleanContext?: PromiseContext["onCleanContext"],
  onCancel?: PromiseContext["onCancel"]
): Task {
  const context: PromiseContext = {
    cancelled: false,
    onRestoreContext,
    onCleanContext,
    onCancel,
  };
  const start = () => {
    const tmp = setPromiseContext(context);
    patchPromise();
    const promise = cb();
    restorePromise();
    resetPromiseContext(tmp);
    return promise;
  };

  return {
    cancel: () => {
      if (context.cancelled) return;
      context.cancelled = true;
      onCancel?.();
    },
    get isCancel() {
      return context.cancelled;
    },
    start,
  };
}

let currentPromiseContext: PromiseContext | undefined;
export const getPromiseContext = () => currentPromiseContext;
export const setPromiseContext = (ctx: PromiseContext | undefined) => {
  const tmpContext = ctx;
  currentPromiseContext = ctx;
  return tmpContext;
};
export const resetPromiseContext = (ctx: PromiseContext | undefined) => {
  currentPromiseContext = ctx;
};

const OriginalPromise = Promise;
const originalThen = Promise.prototype.then;

const ProxyPromise = new Proxy(OriginalPromise, {
  construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget);
    const obj = Object.create(instance);
    obj.execContext = currentPromiseContext;
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
const _exec = (execContext: PromiseContext | undefined, cb: Function, args: any[]) => {
  if (execContext?.cancelled) return;
  let tmp = currentPromiseContext;
  originalThen.call(OriginalPromise.resolve(), () => {
    patchPromise();
    execContext?.onRestoreContext?.();
    currentPromiseContext = execContext;
  });
  currentPromiseContext = execContext;
  const result = cb(...args);
  originalThen.call(OriginalPromise.resolve(), () => {
    restorePromise();
    execContext?.onCleanContext?.();
    currentPromiseContext = tmp;
  });
  return result;
};

function patchPromise() {
  window.Promise = ProxyPromise;
}
function restorePromise() {
  window.Promise = OriginalPromise;
}
