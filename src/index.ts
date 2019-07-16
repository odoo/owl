/**
 * This file is the main file packaged by rollup (see rollup.config.js).  From
 * this file, we export all public owl elements.
 *
 * Note that dynamic values, such as a date or a commit hash are added by rollup
 */
import { EventBus } from "./core/event_bus";
import { Observer } from "./core/observer";
import { QWeb } from "./qweb/index";
import { ConnectedComponent } from "./store/connected_component";
import { Store } from "./store/store";
import * as _utils from "./utils";
import { Link } from "./router/Link";
import { activate } from "./router/plugin";

export { Component } from "./component/component";
export { QWeb };
export const core = { EventBus, Observer };
export const router = { activate, Link };
export const store = { Store, ConnectedComponent };
export const utils = _utils;

export const __info__ = {};

Object.defineProperty(__info__, "mode", {
  get() {
    return QWeb.dev ? "dev" : "prod";
  },
  set(mode: string) {
    QWeb.dev = mode === "dev";
    if (QWeb.dev) {
      const url = `https://github.com/odoo/owl/blob/master/doc/tooling.md#development-mode`;
      console.warn(
        `Owl is running in 'dev' mode.  This is not suitable for production use. See ${url} for more information.`
      );
    } else {
      console.log(`Owl is now running in 'prod' mode.`);
    }
  }
});
