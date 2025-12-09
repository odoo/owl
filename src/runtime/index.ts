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
export { Resource, useResource } from "./resource";
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
export { props } from "./props";
export type { GetProps, PropsValidation } from "./props";
export { status } from "./status";
export { proxy, markRaw, toRaw } from "./reactivity/proxy";
export { untrack } from "./reactivity/computations";
export { signal } from "./reactivity/signal";
export { derived } from "./reactivity/derived";
export { effect } from "./reactivity/effect";
export { useEffect, useListener, useRef, usePlugins } from "./hooks";
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

export { Plugin, PluginManager, plugin } from "./plugins";
export type { PluginConstructor } from "./plugins";
