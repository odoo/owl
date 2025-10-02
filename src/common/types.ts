export type ExecutionContext = {
  onReadAtom: (atom: Atom) => void;
  unsubcribe?: (scheduledContexts: Set<ExecutionContext>) => void;
  update?: Function;
  atoms?: Set<Atom>;
  meta?: any;
  // getParent: () => ExecutionContext | undefined;
  // getChildren: () => ExecutionContext[];
  // schedule: () => void;
};

export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

export type Atom = {
  executionContexts: Set<ExecutionContext>;
  dependents: Set<DerivedAtom>;
  getValue: () => any;
};

export type OldValue = any;

export type DerivedAtom = Atom & {
  dependencies: Map<Atom, OldValue>;
  computed: boolean;
};
