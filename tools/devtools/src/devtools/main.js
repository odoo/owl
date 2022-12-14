/** @odoo-module **/

import { DevtoolsApp } from "./components/devtools_app";
import { mount, whenReady } from "@odoo/owl";
import { Accordion, Navbar } from "bootstrap/dist/js/bootstrap.min.js";

import "../main.css";
import "../../assets/templates.js";


chrome.devtools.panels.create("Owl", "MyPanelIcon.png", "devtools/devtools.html", function (panel) {
    (async () => {
        await whenReady();
        await mount(DevtoolsApp, document.body, {});
    })();
});
