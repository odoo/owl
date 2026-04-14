/// <reference path="../build-env.d.ts" />
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
export { props } from "./props";
export type { GetProps } from "./props";
export { status } from "./status";
export { proxy, markRaw, toRaw } from "./reactivity/proxy";
export { untrack, type ReactiveValue } from "./reactivity/computations";
export { signal, type Signal } from "./reactivity/signal";
export { computed } from "./reactivity/computed";
export { effect } from "./reactivity/effect";
export { useEffect, useListener, useApp } from "./hooks";
export { batched, EventBus, htmlEscape, whenReady, markup } from "./utils";
export {
  onWillStart,
  onMounted,
  onWillUnmount,
  onWillUpdateProps,
  onWillPatch,
  onPatched,
  onWillDestroy,
  onError,
} from "./lifecycle_hooks";
export { assertType, validateType } from "./validation";
export { types } from "./types";
export { OwlError } from "../common/owl_error";
export { config, plugin, providePlugins } from "./plugin_hooks";
export type { PluginInstance } from "./plugin_hooks";
export { Plugin } from "./plugin_manager";
export type { PluginConstructor } from "./plugin_manager";
export { useContext } from "./context";
export type { CapturedContext } from "./context";

export const __info__: Record<string, string> = {
  version: App.version,
  date: __BUILD_DATE__,
  hash: __BUILD_HASH__,
  url: "https://github.com/odoo/owl",
};
