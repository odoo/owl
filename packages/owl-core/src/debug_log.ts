// Lightweight, opt-in event buffer for tracing render/scheduler/reactive
// activity during a recorded scenario. Disabled by default — `logEvent`
// returns immediately if `debugEnabled` is false, so the calls compile to
// near-noop in production. Toggle with `setDebugEnabled(true)`, run the
// scenario, then dump `debugLog` (or call `dumpDebugLog()` for a JSON
// string suitable for copy-paste).
//
// Identity: `getId(obj)` returns a stable monotonic number for any object
// it has seen before. Used to give ComponentNodes / Fibers / Computations
// a compact id so events can reference them without repeating their type
// information.
//
// Each event is `{ t, event, ...data }` where `t` is the buffer position
// (cheap monotonic counter, no clock reads).

const ids = new WeakMap<object, number>();
let nextId = 1;

export function getId(obj: object): number {
  let id = ids.get(obj);
  if (id === undefined) {
    id = nextId++;
    ids.set(obj, id);
  }
  return id;
}

export const debugLog: any[] = [];

let debugEnabled = false;

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

export function setDebugEnabled(value: boolean): void {
  debugEnabled = value;
}

export function logEvent(event: string, data: object = {}): void {
  if (!debugEnabled) return;
  debugLog.push({ t: debugLog.length, event, ...data });
}

export function clearDebugLog(): void {
  debugLog.length = 0;
}

export function dumpDebugLog(): string {
  return JSON.stringify(debugLog);
}
