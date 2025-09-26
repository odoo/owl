import { ComponentNode } from "../runtime/component_node";
import { MountOptions } from "../runtime/fibers";

export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

// PromiseContext

export type PromiseContext = {
  cancelled: boolean;
  onRestoreContext?: Function;
  onCleanContext?: Function;
  onCancel?: Function;
};
export type CancellablePromise<T = any> = Promise<T> & { execContext?: PromiseContext };

// Reactivity system

export enum ComputationState {
  EXECUTED = 0,
  STALE = 1,
  PENDING = 2,
  ASYNC_PENDING = 3,
}
export type ComputationAsync = {
  // promise: Promise<any>;
  // promiseState: "pending" | "resolved" | "rejected";
  // subscribers: Function[];
  task: Task;
  transaction?: Transaction<any>;
};
export type Computation<T = any> = {
  compute?: () => T;
  state: ComputationState;
  sources: Set<Atom | Derived<any, any>>;
  isEager?: boolean;
  isDerived?: boolean;
  value: T; // for effects, this is the cleanup function
  childrenEffect?: Computation[]; // only for effects
  isAsync?: boolean;
  async?: ComputationAsync;
  // transaction?: Transaction<any>;
} & Opts;
export type Opts = {
  name?: string;
  debug?: boolean;
};
export type Atom<T = any> = {
  value: T;
  observers: Set<Computation>;
} & Opts;

export interface Derived<Prev, Next = Prev> extends Atom<Next>, Computation<Next> {}

export type OldValue = any;

export type Getter<V> = () => V | null;
export type Setter<T, V> = (this: T, value: V) => void;
export type MakeGetSetReturn<T, V> = readonly [Getter<V>] | readonly [Getter<V>, Setter<T, V>];
export type MakeGetSet<T, V> = (obj: T) => MakeGetSetReturn<T, V>;

// Async derived states

export type BaseAsyncState<S extends string, L extends boolean, E, Latest> = {
  state: S;
  loading: L;
  error: E;
  latest: Latest;
  (): Latest;
};
export type Unresolved = BaseAsyncState<"unresolved", false, undefined, undefined>;
export type Pending = BaseAsyncState<"pending", true, undefined, undefined>;
export type Ready<T> = BaseAsyncState<"ready", false, undefined, T>;
export type Refreshing<T> = BaseAsyncState<"refreshing", true, undefined, T>;
export type Errored = BaseAsyncState<"errored", false, any, never>;
export type DerivedAsyncStates = "unresolved" | "pending" | "ready" | "refreshing" | "errored";
export type DerivedAsyncRead<T> = Unresolved | Pending | Ready<T> | Refreshing<T> | Errored;
export type DerivedAsyncReturn<T> = [DerivedAsyncRead<T>];

// Transactions
export type TransitionState = "sync" | "pending" | "ready" | "errored";
export type Transaction<T = undefined> = {
  parent?: Transaction;
  state: () => TransitionState;
  increment: () => void;
  decrement: () => void;
  error: () => Error | undefined;
  setError: (e: Error) => void;
  // onComplete: () => void;
  data: T;
  effects: Set<Computation>;
  // effects: (() => void)[];
  // resolved: boolean;
};
export type ComponentNodeRenderTransaction = {
  // node: ComponentNode;
  nodeToBDomMap: Map<any, any>;
  // renders: Map<ComponentNode, render>;
};

// Task
export type Task = {
  isCancel: boolean;
  cancel: () => void;
  start: () => Promise<any>;
  // promise: Promise<any>;
};

// MountInfos
export type MountInfos = { target: any; options?: MountOptions };
