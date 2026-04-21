export function getConsoleOutput(): string[] {
  return (globalThis as any).__owl_console_output.splice(0);
}
