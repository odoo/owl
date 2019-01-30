///<amd-module name="main" />

import { makeEnvironment } from "./env";
import { registry } from "./registry";
import { Discuss } from "./widgets/discuss";
import { Root } from "./root";
import { debounce } from "./core/utils";

//------------------------------------------------------------------------------
// Prepare application registry
//------------------------------------------------------------------------------
registry.add("action", "discuss", Discuss);

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
