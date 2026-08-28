import { vi, type Mock } from "vitest";
import { effect } from "@odoo/owl";

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

export async function nextTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function waitScheduler() {
  await nextMicroTick();
  await nextMicroTick();
}

let lastFixture: any = null;

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  if (lastFixture) {
    lastFixture.remove();
  }
  lastFixture = fixture;
  return fixture;
}

export type SpyEffect<T> = (() => () => void) & { spy: Mock };
export function spyEffect<T>(fn: () => T): SpyEffect<T> {
  const spy = vi.fn(fn);
  const unsubscribeWrapper = () => effect(spy);
  const wrapped = Object.assign(unsubscribeWrapper, { spy }) as SpyEffect<T>;
  return wrapped;
}
