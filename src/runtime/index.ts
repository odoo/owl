import { App } from "./app";
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
  comment,
} from "./blockdom";
import { mainEventHandler } from "./event_handling";

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
  comment,
};

export { App, mount } from "./app";
export { xml } from "./template_set";
export { Component } from "./component";
export type { ComponentConstructor } from "./component";
export { useComponent, useState } from "./component_node";
export { status } from "./status";
export { reactive, markRaw, toRaw } from "./reactivity";
export { useEffect, useEnv, useExternalListener, useRef, useChildSubEnv, useSubEnv } from "./hooks";
export { EventBus, whenReady, loadFile, markup } from "./utils";
export {
  onWillStart,
  onMounted,
  onWillUnmount,
  onWillUpdateProps,
  onWillPatch,
  onPatched,
  onWillRender,
  onRendered,
  onWillDestroy,
  onError,
} from "./lifecycle_hooks";
export { validate } from "./validation";
export { OwlError } from "./error_handling";

export const __info__ = {
  version: App.version,
};
