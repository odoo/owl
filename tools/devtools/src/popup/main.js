import { PopUpApp } from "./components/popup_app";
import { whenReady, mount } from "@odoo/owl";
import "../main.css";
import "../../assets/templates.js";
// @ts-ignore
// window.console = chrome.extension.getBackgroundPage().console;

const init = () => {
  (async () => {
    await whenReady();
    await mount(PopUpApp, document.body, {});
  })();
};

window.onload = init;
