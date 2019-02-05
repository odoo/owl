///<amd-module name="main" />

import { init } from "./init";
import { Root } from "./widgets/root";

//------------------------------------------------------------------------------
// Web Client Bootstrapping
//------------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async function() {
  const { env, menuInfo } = await init();

  // Creating root widget
  const rootWidget = new Root(env, { menuInfo });
  await rootWidget.mount(document.body);

  // For debugging purpose, we keep a reference to the root widget in odoo
  (<any>window).odoo.rootWidget = rootWidget;
});
