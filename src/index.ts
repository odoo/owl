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
  comment,
};

export { App, mount } from "./app/app";
export { Component } from "./component/component";
export { useComponent } from "./component/component_node";
export { status } from "./component/status";
export { Portal } from "./portal";
export { Memo } from "./memo";
export { xml } from "./app/template_set";
export { useState, reactive } from "./reactivity";
export { useEffect, useEnv, useExternalListener, useRef, useSubEnv } from "./hooks";
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
} from "./component/lifecycle_hooks";

export const __info__ = {};
