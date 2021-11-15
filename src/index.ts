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
import { EventBus, whenReady, loadFile } from "./utils";

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

import type { AppConfig } from "./app/app";
import { App } from "./app/app";
import { Component } from "./component/component";
import { getCurrent } from "./component/component_node";

export { App, Component };

export async function mount<T extends typeof Component>(
  C: T,
  target: HTMLElement,
  config: AppConfig = {}
): Promise<InstanceType<T>> {
  const app = new App(C);
  return app.configure(config).mount(target);
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
export { useRef, useEnv, useSubEnv } from "./hooks";
export const utils = { EventBus, whenReady, loadFile };

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
