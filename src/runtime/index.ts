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
export { Registry } from "./registry";

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
export { useComponent } from "./component_node";
export { status } from "./status";
export { proxy, markRaw, toRaw } from "./reactivity";
export { effect, withoutReactivity, derived, signal } from "./signals";
export { useEffect, useEnv, useListener, useRef, useChildSubEnv, useSubEnv } from "./hooks";
export { batched, EventBus, htmlEscape, whenReady, markup } from "./utils";
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
export { validate, validateType } from "./validation";
export { OwlError } from "../common/owl_error";

export const __info__ = {
  version: App.version,
};

export { Plugin, PluginManager, plugin, usePlugins } from "./plugins";
export type { PluginConstructor } from "./plugins";
