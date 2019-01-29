///<amd-module name="main" />

import { makeEnvironment } from "./env";
import { registry } from "./registry";
import { Discuss } from "./widgets/discuss";
import { Root } from "./root";

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
});
