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
export { Resource, Registry } from "@odoo/owl-core";

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
export { useProps, props } from "./props";
// `isProps` is a phantom (declare const) brand symbol referenced by the public
// `Props`/`PropsWithDefaults`/`GetProps` types. It must be exported from the
// package's type surface so downstream projects can name it when emitting their
// own declaration files (see owl#1958). Type-only export: it has no runtime
// value, so this adds nothing to the JS bundle.
export type { GetProps, isProps } from "./props";
export { status } from "./status";
export {
  asyncComputed,
  computed,
  effect,
  immediateEffect,
  markRaw,
  proxy,
  signal,
  toRaw,
  untrack,
  type AsyncComputed,
  type AsyncComputedContext,
  type AsyncComputedOptions,
  type Equals,
  type ReactiveValue,
  type Signal,
} from "@odoo/owl-core";
export { useEffect, useListener, useApp } from "./hooks";
export { batched, EventBus, htmlEscape, shallowEqual, whenReady, markup } from "./utils";
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
export { applyDefaults, assertType, getDefault, validateType } from "@odoo/owl-core";
// `t` is the documented short alias of `types`. Both must point to the
// runtime namespace (which extends the core one with `component`), so do not
// re-export them from @odoo/owl-core.
export { types, types as t } from "./types";
export type {
  hasDefault,
  isOptional,
  Optional,
  ShapeType,
  StripBrands,
  Type,
  typeBrand,
  WithDefault,
} from "@odoo/owl-core";
export { OwlError } from "@odoo/owl-core";
export { useConfig, config, usePlugin, plugin, providePlugins } from "./plugin_hooks";
export type { PluginInstance } from "./plugin_hooks";
export { Plugin } from "@odoo/owl-core";
export type { PluginConstructor } from "@odoo/owl-core";
export { getScope, Scope, useScope } from "@odoo/owl-core";

export const __info__: Record<string, string> = {
  version: App.version,
  date: __BUILD_DATE__,
  hash: __BUILD_HASH__,
  url: "https://github.com/odoo/owl",
};
