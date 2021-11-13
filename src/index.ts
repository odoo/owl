import {
  config,
  createBlock,
  html,
  list,
  mount as blockMount,
  multi,
  patch,
  remove,
  text,
  toggler,
} from "./blockdom";
import { mainEventHandler } from "./component/handler";

config.shouldNormalizeDom = false;
config.mainEventHandler = mainEventHandler;

export const blockDom = {
  config,
  // bdom entry points
  mount: blockMount,
  patch,
  remove,
  // bdom block types
  list,
  multi,
  text,
  toggler,
  createBlock,
  html,
};

// import { makeBlockClass } from "./_old_bdom/element";
import { App } from "./app/app";
import { Component } from "./component/component";
import { getCurrent } from "./component/component_node";
// import { getCurrent } from "./b_node";

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

export { status } from "./component/status";
export { Portal } from "./misc/portal";
export { Memo } from "./misc/memo";
export { css, xml } from "./tags";
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
  onError,
} from "./component/lifecycle_hooks";

export const __info__ = {};
