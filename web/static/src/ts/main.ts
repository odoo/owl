///<amd-module name="main" />

import { makeEnv } from "./env";
import { loadMenus, loadTemplates } from "./loaders";
import { actionRegistry } from "./registries";
import { rpc } from "./services/ajax";
import { Router } from "./services/router";
import { Store } from "./store/store";
import { Root } from "./widgets/root";

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
  const store = new Store(services, menuInfo, actionRegistry);
  const env = makeEnv(store, templates);

  // Creating root widget
  const rootWidget = new Root(env, store);
  await rootWidget.mount(document.body);

  // For debugging purpose, we keep a reference to the root widget in odoo
  (<any>window).odoo.rootWidget = rootWidget;
});

let testMixin = Base =>
  class extends Base {
    calc() {
      return 32;
    }
  };

class Foo {}

class Bar extends testMixin(Foo) {}

console.log(new Bar().calc());
