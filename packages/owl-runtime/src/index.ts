/// <reference path="./build-env.d.ts" />
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
} from "./blockdom";
import { mainEventHandler } from "./event_handling";
export { Resource } from "./resource";
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
};
export { App, mount } from "./app";
export { xml, TemplateSet, globalTemplates } from "./template_set";
export type { TemplateSetConfig } from "./template_set";
export { Component } from "./component";
export type { ComponentConstructor } from "./component";
export { ErrorBoundary } from "./error_boundary";
export { Portal } from "./portal";
export { Suspense } from "./suspense";
export { props } from "./props";
export type { GetProps } from "./props";
export { status } from "./status";
export { proxy, markRaw, toRaw } from "./reactivity/proxy";
export { untrack, type ReactiveValue } from "./reactivity/computations";
export { signal, type Signal } from "./reactivity/signal";
export { computed } from "./reactivity/computed";
export { asyncComputed } from "./reactivity/async_computed";
export type {
  AsyncComputed,
  AsyncComputedContext,
  AsyncComputedOptions,
} from "./reactivity/async_computed";
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
export { OwlError } from "@odoo/owl-core";
export { config, plugin, providePlugins } from "./plugin_hooks";
export type { PluginInstance } from "./plugin_hooks";
export { Plugin } from "./plugin_manager";
export type { PluginConstructor } from "./plugin_manager";
export { getScope, Scope, useScope } from "./scope";

export const __info__: Record<string, string> = {
  version: App.version,
  date: __BUILD_DATE__,
  hash: __BUILD_HASH__,
  url: "https://github.com/odoo/owl",
};
