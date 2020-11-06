import { DevtoolsApp } from "./components/devtools_app";
import { utils } from "@odoo/owl";

import '../main.css'

(async () => {
  const app = new DevtoolsApp();
  await utils.whenReady();
  await app.mount(document.body);
})();
