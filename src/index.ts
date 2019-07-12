/**
 * This file is the main file packaged by rollup (see rollup.config.js).  From
 * this file, we export all public owl elements.
 *
 * Note that dynamic values, such as a date or a commit hash are added by rollup
 */
export { Component } from "./component";
export { EventBus } from "./event_bus";
export { Observer } from "./observer";

// we need to import manually the extra directives so they can register
// themselves in QWeb, otherwise these files will not even be loaded.
import "./qweb_directives";
import "./qweb_extensions";
import { QWeb } from "./qweb_core";
export { QWeb };

export { Store, ConnectedComponent } from "./store";
import * as _utils from "./utils";

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
export const utils = _utils;
