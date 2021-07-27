import { App } from "./app";
import { Component } from "./component";
import { getCurrent } from "./b_node";

export { App, Component };

export async function mount<T extends typeof Component>(
  C: T,
  target: HTMLElement
): Promise<InstanceType<T>> {
  const app = new App(C);
  return app.mount(target);
}

export function useComponent(): Component {
  const current = getCurrent();
  return current!.component;
}

export { status } from "./status";
export { Portal } from "./misc/portal";
export { Memo } from "./misc/memo";
export { xml } from "./tags";
export { useState } from "./reactivity";
export { useRef } from "./refs";
export { EventBus } from "./event_bus";

export {
  onWillStart,
  onMounted,
  onWillUnmount,
  onWillUpdateProps,
  onWillPatch,
  onPatched,
  onRender,
  onDestroyed,
} from "./lifecycle_hooks";

export const __info__ = {};
