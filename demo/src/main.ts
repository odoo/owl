///<amd-module name="main" />

// import RootWidget from "./RootWidget";
import Counter from "./Counter";
import env from "./env";

document.addEventListener("DOMContentLoaded", async function() {
  const rootWidget = new Counter(null);
  rootWidget.setEnvironment(env);
  const mainDiv = document.getElementById("app")!;
  await rootWidget.mount(mainDiv);
});
