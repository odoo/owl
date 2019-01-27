///<amd-module name="main" />

import { makeEnvironment } from "./env";
import { registry } from "./registry";
import { Discuss } from "./widgets/discuss";
import { RootWidget } from "./widgets/root_widget";

//------------------------------------------------------------------------------
// Prepare application registry
//------------------------------------------------------------------------------
registry.addAction("discuss", Discuss);

//------------------------------------------------------------------------------
// Application bootstrapping
//------------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async function() {
  const env = makeEnvironment();
  const rootWidget = new RootWidget(env);
  await rootWidget.mount(document.body);
});
