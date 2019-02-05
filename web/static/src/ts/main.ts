///<amd-module name="main" />

import { makeEnvironment } from "./env";
import { BaseMenuItem, processMenuItems } from "./misc/menu_helpers";
import { Root } from "./widgets/root";

//------------------------------------------------------------------------------
// Application bootstrapping
//------------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async function() {
  const env = await makeEnvironment();

  // menu processing
  const menuItems: BaseMenuItem[] = (<any>window).odoo.menus;
  const menuInfo = processMenuItems(menuItems);
  delete (<any>window).odoo.menus; // overkill?

  // creating root widget
  const rootWidget = new Root(env, { menuInfo });
  await rootWidget.mount(document.body);
  (<any>window).odoo.rootWidget = rootWidget;
});
