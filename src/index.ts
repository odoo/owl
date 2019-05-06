export { Component } from "./component";
export { EventBus } from "./event_bus";
export { Observer } from "./observer";

import "./qweb_directives";
import "./qweb_extensions";
export { QWeb } from "./qweb_core";

export { connect, Store } from "./store";
import * as _utils from "./utils";


export const utils = _utils;
