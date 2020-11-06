import { DevtoolsApp } from "./components/devtools_app";
import { utils } from "@odoo/owl";

import "../main.css";

chrome.devtools.panels.create("Owl", "MyPanelIcon.png", "devtools/devtools.html", function (panel) {
    console.log("devtools.js is reading, owl starts...");

    (async () => {
        const app = new DevtoolsApp();
        await utils.whenReady();
        await app.mount(document.body);
    })();
});
