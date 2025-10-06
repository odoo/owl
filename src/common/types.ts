export enum ExecutionState {
  EXECUTED = 0,
  STALE = 1,
  PENDING = 2,
}

export type ExecutionContext<T = any> = {
  onReadAtom: (atom: Atom) => void;
  unsubcribe?: (scheduledContexts: Set<ExecutionContext>) => void;
  compute?: () => T;
  // atoms?: Set<Atom>;
  meta?: any;
  state: ExecutionState;
  sources: Set<Atom | Memo<any, any>>;
  isMemo?: boolean;
  // getParent: () => ExecutionContext | undefined;
  // getChildren: () => ExecutionContext[];
  // schedule: () => void;
};

export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

export type Atom<T = any> = {
  value: T;
  observers: Set<ExecutionContext>;
  // getValue: () => any;
  // checkId: number;
};

export interface Memo<Prev, Next = Prev> extends Atom<Next>, ExecutionContext<Next> {}

export type OldValue = any;

// export type DerivedAtom = Atom & {
//   sources: Map<Atom, OldValue>;
//   computed: boolean;
// };
