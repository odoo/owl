///<amd-module name="main" />

import RootWidget from "./RootWidget";
import env from "./env";

document.addEventListener("DOMContentLoaded", async function() {
  const rootWidget = new RootWidget(null);
  rootWidget.setEnvironment(env);
  await rootWidget.mount(document.body);
});
