import {
  ComputationState,
  atomSymbol,
  onReadAtom,
  onWriteAtom,
  updateComputation,
  createComputation,
} from "./computations";

export function asyncComputed<T>(fn: () => Promise<T>): () => Promise<T> {
  let currentVersion = 0;

  const computation = createComputation(
    () => {
      const version = ++currentVersion;
      const innerPromise = fn();
      const promise = new Promise<T>((resolve, reject) => {
        innerPromise.then(
          (value) => {
            if (version === currentVersion && computation.state === ComputationState.EXECUTED) {
              resolve(value);
            }
          },
          (error) => {
            if (version === currentVersion && computation.state === ComputationState.EXECUTED) {
              reject(error);
            }
          }
        );
      });
      onWriteAtom(computation);
      return promise;
    },
    true
  );

  function readAsyncComputed(): Promise<T> {
    updateComputation(computation);
    onReadAtom(computation);
    return computation.value;
  }
  (readAsyncComputed as any)[atomSymbol] = computation;

  return readAsyncComputed;
}
