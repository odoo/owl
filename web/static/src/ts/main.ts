///<amd-module name="main" />

import { makeEnv } from "./env";
import { rpc } from "./services/ajax";
import { loadMenus } from "./loaders/menus";
import { loadTemplates } from "./loaders/templates";
import { Root } from "./widgets/root";

//------------------------------------------------------------------------------
// Web Client Bootstrapping
//------------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async function() {
  const services = {
    rpc
  };
  const loaders = {
    loadTemplates
  };
  const env = await makeEnv(loaders, services);
  const menuInfo = loadMenus();

  // Creating root widget
  const rootWidget = new Root(env, { menuInfo });
  await rootWidget.mount(document.body);

  // For debugging purpose, we keep a reference to the root widget in odoo
  (<any>window).odoo.rootWidget = rootWidget;
});
