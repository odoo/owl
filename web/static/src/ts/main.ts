///<amd-module name="main" />

import { debounce } from "./core/utils";
import { makeEnvironment } from "./env";
import { Root } from "./widgets/root";
import { BaseMenuItem, processMenuItems } from "./misc/menu_helpers";

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

  // adding reactiveness to mobile/non mobile
  window.addEventListener("resize", <any>debounce(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== env.isMobile) {
      env.isMobile = isMobile;
      rootWidget.render();
    }
  }, 50));
});
