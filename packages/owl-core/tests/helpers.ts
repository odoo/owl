import { vi, type Mock } from "vitest";
import { effect } from "../src";

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

export async function waitScheduler() {
  await nextMicroTick();
  await nextMicroTick();
}

export function expectSpy(
  spy: Mock,
  count: number,
  opt: { args?: any[]; result?: any } = {}
): void {
  expect(spy).toHaveBeenCalledTimes(count);
  if ("args" in opt) expect(spy).toHaveBeenLastCalledWith(...opt.args!);
  if ("result" in opt) expect(spy).toHaveReturnedWith(opt.result);
}

export type SpyEffect = (() => () => void) & { spy: Mock };
export function spyEffect<T>(fn: () => T): SpyEffect {
  const spy = vi.fn(fn);
  const unsubscribeWrapper = () => effect(spy);
  const wrapped = Object.assign(unsubscribeWrapper, { spy }) as SpyEffect;
  return wrapped;
}
