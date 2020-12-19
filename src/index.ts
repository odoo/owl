/**
 * This file is the main file packaged by rollup (see rollup.config.js).  From
 * this file, we export all public owl elements.
 *
 * Note that dynamic values, such as a date or a commit hash are added by rollup
 */
import * as _hooks from "./hooks";
import { useComponent } from "./core";
export { EventBus } from "./event_bus";
export { Context } from "./context";

export { Component, mount, useComponent } from "./core";
export { xml } from "./tags";

export { useState } from "./hooks";

export const hooks = Object.assign(_hooks, { useComponent: useComponent });

export const __info__ = {};
