export enum ComputationState {
  EXECUTED = 0,
  STALE = 1,
  PENDING = 2,
}

export type Computation<T = any> = {
  unsubcribe?: () => void;
  compute?: () => T;
  meta?: any;
  state: ComputationState;
  sources: Set<Atom | Derived<any, any>>;
  isDerived?: boolean;
  value: T;
};

export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

export type Atom<T = any> = {
  value: T;
  observers: Set<Computation>;
};

export interface Derived<Prev, Next = Prev> extends Atom<Next>, Computation<Next> {}

export type OldValue = any;
