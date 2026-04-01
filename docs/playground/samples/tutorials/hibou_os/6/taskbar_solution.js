import { Component, plugin } from "@odoo/owl";
import { Clock } from "./clock";
import { WindowManagerPlugin } from "./window/window_manager_plugin";
import { HelloApp } from "./hello_app";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";
    static components = { Clock };

    wm = plugin(WindowManagerPlugin);

    openClock() {
        this.wm.open("Clock", HelloApp);
    }
}
