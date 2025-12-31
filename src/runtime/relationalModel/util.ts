export function mapEntries<T, U>(
  obj: Record<string, T>,
  fn: (entry: [string, T]) => [string, U]
): Record<string, U> {
  return Object.fromEntries(Object.entries(obj).map(fn));
}
