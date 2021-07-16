import { App } from "./app";
import { Component } from "./component";

export { App, Component };

export async function mount<T extends typeof Component>(
  C: T,
  target: HTMLElement
): Promise<InstanceType<T>> {
  const app = new App(C);
  return app.mount(target);
}

export { status } from "./status";
export { Portal, NoUpdate } from "./utility_components";
export { xml } from "./tags";
export { useState } from "./reactivity";
export { useRef } from "./refs";
export { EventBus } from "./event_bus";

export {
  onWillStart,
  onMounted,
  onBeforeUnmount,
  onWillUpdateProps,
  onBeforePatch,
  onPatched,
} from "./lifecycle_hooks";

export const __info__ = {};
