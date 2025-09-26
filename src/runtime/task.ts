import { getTaskContext, TaskContext, useTaskContext } from "./cancellableContext";

export class Task<T = any> {
  _promise: Promise<T>;
  _ctx?: TaskContext = getTaskContext();

  constructor(
    executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason: any) => void) => void,
    public _onCancelled?: Function
  ) {
    if (!this._ctx) {
      this._promise = new Promise(executor);
      return;
    }

    this._promise = new Promise((resolve, reject) => {
      try {
        executor(
          (value: T | PromiseLike<T>) => {
            if (!this._ctx?.isCancelled) resolve(value);
          },
          (error: any) => {
            if (!this._ctx?.isCancelled) reject(error);
          }
        );
      } catch (err) {
        if (!this._ctx?.isCancelled) reject(err);
      }
    });
  }

  then(onFulfilled: (value: any) => any, onRejected: (error: any) => any) {
    if (!this._ctx) return this._promise.then(onFulfilled, onRejected);
    return this._promise.then((v) => {
      if (this._ctx!.isCancelled) return;
      let cleanup: Function;
      Promise.resolve().then(() => {
        const ctx = useTaskContext(this._ctx);
        cleanup = ctx.cleanup;
      });
      const result = onFulfilled(v);
      Promise.resolve().then(() => {
        cleanup();
      });
      return result;
    }, onRejected);
  }

  catch(onRejected: (error: any) => any) {
    return this._promise.catch(onRejected);
  }

  finally(onFinally: () => any) {
    return this._promise.finally(onFinally);
  }

  cancel() {
    if (this._onCancelled) {
      this._onCancelled();
    }
  }

  get [Symbol.toStringTag]() {
    return "Promise";
  }

  //   static all(tasks) {
  //     return new Task((resolve, reject) => {
  //       Promise.all(tasks.map((t) => (t instanceof Task ? t._promise : t))).then(resolve, reject);
  //     });
  //   }
}
