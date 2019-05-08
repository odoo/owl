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
export { QWeb } from "./qweb_core";

export { connect, Store } from "./store";
import * as _utils from "./utils";


export const utils = _utils;
