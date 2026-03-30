import { Component, providePlugins, plugin } from "@odoo/owl";
import { Taskbar } from "./taskbar";
import { ManagedWindow } from "./managed_window";
import { WindowManagerPlugin } from "./window_manager_plugin";

export class Hibou extends Component {
    static template = "hibou.Hibou";
    static components = { Taskbar, ManagedWindow };

    setup() {
        providePlugins([WindowManagerPlugin]);
        this.wm = plugin(WindowManagerPlugin);
    }
}
