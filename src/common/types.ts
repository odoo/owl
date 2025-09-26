export type ExecutionContext = {
  unsubcribe?: (scheduledContexts: Set<ExecutionContext>) => void;
  update: Function;
  signals: Set<Signal>;
  getParent: () => ExecutionContext | undefined;
  getChildren: () => ExecutionContext[];
  meta: any;
  // schedule: () => void;
};

export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier: string[]) => void
>;

export type Signal = {
  executionContexts: Set<ExecutionContext>;
};
