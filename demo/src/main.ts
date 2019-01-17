///<amd-module name="main" />

import QWeb from "../../src/core/qweb_vdom";
import {init} from "../../src/libs/snabbdom/src/snabbdom"
import h from "../../src/libs/snabbdom/src/h"
import sdProps from "../../src/libs/snabbdom/src/modules/props"
import sdListeners from "../../src/libs/snabbdom/src/modules/eventlisteners"

const patch = init([sdProps, sdListeners]);

(<any>window).h = h;
(<any>window).patch = patch;
(<any>window).QWeb = QWeb;
// import RootWidget from "./RootWidget";
// import env from "./env";

// document.addEventListener("DOMContentLoaded", async function() {
//   const rootWidget = new RootWidget(null);
//   rootWidget.setEnvironment(env);
//   const mainDiv = document.getElementById("app")!;
//   await rootWidget.mount(mainDiv);
// });
