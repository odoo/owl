///<amd-module name="main" />

import { makeEnv, linkStoreToEnv } from "./env";
import { loadMenus, loadTemplates } from "./loaders";
import { actionRegistry, viewRegistry } from "./registries";
import { rpc } from "./services/ajax";
import { Router } from "./services/router";
import { Store } from "./store/store";
import { Root } from "./ui/root";

//------------------------------------------------------------------------------
// Web Client Bootstrapping
//------------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async function() {
  const services = {
    rpc,
    router: new Router()
  };

  const templates = await loadTemplates();
  const menuInfo = loadMenus();
  const env = makeEnv({ services, templates, actionRegistry, viewRegistry });
  const store = new Store(env, menuInfo);
  linkStoreToEnv(env, store);

  // Creating root widget
  const rootWidget = new Root(env, store);
  await rootWidget.mount(document.body);

  // For debugging purpose, we keep a reference to the root widget in odoo
  (<any>window).odoo.rootWidget = rootWidget;
});
