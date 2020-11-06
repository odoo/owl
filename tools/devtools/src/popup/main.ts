import { PopUpApp } from "./components/pupup_app";
import { utils } from "@odoo/owl";

import "../main.css";

// @ts-ignore
window.console = chrome.extension.getBackgroundPage().console;

const init = () => {
    console.log("popup.js is reading, owl starts...");

    (async () => {
        const app = new PopUpApp();
        await utils.whenReady();
        await app.mount(document.body);
    })();

};

window.onload = init;

