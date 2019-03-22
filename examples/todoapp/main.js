import TodoApp from "./components/TodoApp.js";
import { makeStore } from "./store.js";

async function makeEnv() {
  const result = await fetch("templates.xml");
  if (!result.ok) {
    throw new Error("Error while fetching xml templates");
  }
  let templates = await result.text();
  templates = templates.replace(/<!--[\s\S]*?-->/g, "");
  const qweb = new odoo.core.QWeb();
  qweb.loadTemplates(templates);
  return {
    qweb,
    store: makeStore()
  };
}

document.addEventListener("DOMContentLoaded", async function() {
  const env = await makeEnv();
  const app = new TodoApp(env);

  // for debugging purpose
  window.app = app;
  await app.mount(document.body);
});
