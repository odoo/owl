export enum ComputationState {
  EXECUTED = 0,
  STALE = 1,
  PENDING = 2,
}

export type Computation<T = any> = {
  compute?: () => T;
  state: ComputationState;
  sources: Set<Atom | Derived<any, any>>;
  isDerived?: boolean;
  value: T; // for effects, this is the cleanup function
  childrenEffect?: Computation[]; // only for effects
} & Opts;
export type Opts = {
  name?: string;
};
export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

export type Atom<T = any> = {
  value: T;
  observers: Set<Computation>;
} & Opts;

export interface Derived<Prev, Next = Prev> extends Atom<Next>, Computation<Next> {}

export type OldValue = any;

export type Getter<V> = () => V | null;
export type Setter<T, V> = (this: T, value: V) => void;
export type MakeGetSetReturn<T, V> = readonly [Getter<V>] | readonly [Getter<V>, Setter<T, V>];
export type MakeGetSet<T, V> = (this: T) => MakeGetSetReturn<T, V>;
