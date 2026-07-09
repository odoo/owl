import { Component, usePlugin } from "@odoo/owl";
import { Clock } from "./clock";
import { WindowManagerPlugin } from "./window/window_manager_plugin";
import { HelloApp } from "./hello_app";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";
    static components = { Clock };

    wm = usePlugin(WindowManagerPlugin);

    openClock() {
        this.wm.open("Clock", HelloApp);
    }
}
