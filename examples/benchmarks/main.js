import { App } from "./app.js";

function createApp(el) {
  const env = {
    qweb: new odoo.core.QWeb()
  };
  const app = new App(env, { initialState: 13 });
  app.mount(el);
}

document.addEventListener("DOMContentLoaded", function() {
  createApp(document.body);
});
