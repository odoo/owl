///<amd-module name="main" />

import RootWidget from "./widgets/root_widget";
import {makeEnvironment} from "./env";

document.addEventListener("DOMContentLoaded", async function() {
  const env = makeEnvironment();
  const rootWidget = new RootWidget(env);
  await rootWidget.mount(document.body);
});
