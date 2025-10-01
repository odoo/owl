export type ExecutionContext = {
  unsubcribe?: (scheduledContexts: Set<ExecutionContext>) => void;
  update: Function;
  atoms: Set<Atom>;
  // getParent: () => ExecutionContext | undefined;
  // getChildren: () => ExecutionContext[];
  meta: any;
  // schedule: () => void;
};

export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

export type Atom = {
  executionContexts: Set<ExecutionContext>;
  // dependents: Set<Atom>;
};

// export type DerivedAtom = Atom & {
//   dependencies: Set<Atom>;
// };
