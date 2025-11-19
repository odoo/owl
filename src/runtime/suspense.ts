import { DerivedAsyncStates, Transaction, TransitionState } from "../common/types";
import { ComponentNode } from "./component_node";
import { signal, withoutReactivity } from "./signals";

let currentTransaction: Transaction<any> | undefined;
export function getCurrentTransaction() {
  return currentTransaction;
}
export function setCurrentTransaction(t: Transaction<any> | undefined) {
  currentTransaction = t;
}
export function withTransaction<T>(transaction: Transaction<any> | undefined, cb: () => T): T {
  const previousTransaction = currentTransaction;
  currentTransaction = transaction;
  const result = cb();
  currentTransaction = previousTransaction;
  return result;
}
export function makeTransaction<T>({
  parent,
  data,
  onComplete,
}: {
  parent?: Transaction<any>;
  data?: T;
  onComplete?: (isAsync: boolean) => void;
} = {}): Transaction<T> {
  parent?.increment();
  let count = 0;
  const [error, setError] = signal<Error>(undefined);
  const [state, setState] = signal<TransitionState>("sync");
  let isASync = false;
  return {
    state,
    increment() {
      setState("pending");
      isASync ||= count > 1;
      count++;
    },
    decrement() {
      count--;
      if (count === 0) {
        setState("ready");
        onComplete(isASync);
        isASync = false;
        parent?.decrement();
      }
    },
    effects: new Set(),
    error,
    setError: (e: Error) => {
      // todo: think more thoroughly about error handling in transactions
      setState("errored");
      count = 0;
      setError(e);
      parent.decrement();
    },
    data,
  };
}
