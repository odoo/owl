import { App } from "./components/app";
import { utils } from "@odoo/owl";

import './main.css'

(async () => {
  const app = new App();
  await utils.whenReady();
  await app.mount(document.body);
})();
