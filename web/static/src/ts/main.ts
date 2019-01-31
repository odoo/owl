///<amd-module name="main" />

import { debounce } from "./core/utils";
import { makeEnvironment } from "./env";
import { registry } from "./registry";
import { Root } from "./root";
import { CRM } from "./widgets/crm";
import { Discuss } from "./widgets/discuss";

//------------------------------------------------------------------------------
// Prepare application registry
//------------------------------------------------------------------------------

registry.add("action", "discuss", Discuss);
registry.add("action", "crm", CRM);

//------------------------------------------------------------------------------
// Application bootstrapping
//------------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", async function() {
  const env = makeEnvironment();
  const rootWidget = new Root(env);
  await rootWidget.mount(document.body);

  window.addEventListener("resize", <any>debounce(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== env.isMobile) {
      env.isMobile = isMobile;
      rootWidget.render();
    }
  }, 100));
});
