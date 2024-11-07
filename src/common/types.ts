export type customDirectives = Record<
  string,
  (node: Element, value: string, modifier?: string) => void
>;
