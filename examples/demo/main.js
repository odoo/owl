import { App } from "./app.js";
import { Counter } from "./counter.js";

document.addEventListener("DOMContentLoaded", function() {
  const env = {
    qweb: new odoo.core.QWeb()
  };
  const app = new App(env, { initialState: 13 });
  app.mount(document.body);
});
