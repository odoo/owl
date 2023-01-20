import { PopUpApp } from "./components/popup_app";
const { whenReady, mount } = owl;
import "../main.css";
import "../../assets/templates.js";

const init = () => {
  (async () => {
    await whenReady();
    await mount(PopUpApp, document.body, {dev: true});
  })();
};

window.onload = init;
