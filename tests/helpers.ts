import { Env } from "../src/component";
import { QWeb } from "../src/qweb_core";
import "../src/qweb_directives";
import "../src/qweb_extensions";

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve));
}

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  return fixture;
}

export function normalize(str: string): string {
  return str.replace(/\s+/g, "");
}

interface Deferred extends Promise<any> {
  resolve(val?: any): void;
  reject(): void;
}

export function makeDeferred(): Deferred {
  let resolve, reject;
  let def = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  (<Deferred>def).resolve = resolve;
  (<Deferred>def).reject = reject;
  return <Deferred>def;
}

export function makeTestWEnv(): Env {
  return {
    qweb: new QWeb()
  };
}
