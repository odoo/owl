/**
 * This file is the main file packaged by rollup (see rollup.config.js).  From
 * this file, we export all public owl elements.
 *
 * Note that dynamic values, such as a date or a commit hash are added by rollup
 */
import { EventBus } from "./core/event_bus";
import { Observer } from "./core/observer";
import { QWeb } from "./qweb/index";
import { config } from "./config";
import * as _store from "./store";
import * as _utils from "./utils";
import * as _tags from "./tags";
import { AsyncRoot } from "./misc/async_root";
import { Portal } from "./misc/portal";
import * as _hooks from "./hooks";
import * as _context from "./context";
import { Link } from "./router/link";
import { RouteComponent } from "./router/route_component";
import { Router } from "./router/router";

export { Component } from "./component/component";
export { QWeb };
export { config };

export const Context = _context.Context;
export const useState = _hooks.useState;
export const core = { EventBus, Observer };
export const router = { Router, RouteComponent, Link };
export const Store = _store.Store;
export const utils = _utils;
export const tags = _tags;
export const misc = { AsyncRoot, Portal };
export const hooks = Object.assign({}, _hooks, {
  useContext: _context.useContext,
  useDispatch: _store.useDispatch,
  useGetters: _store.useGetters,
  useStore: _store.useStore,
});
export const __info__ = {};
