import { Component, plugin } from "@odoo/owl";
import { ManagedWindow } from "./managed_window";
import { WindowManagerPlugin } from "./window_manager_plugin";

export class WindowManager extends Component {
    static template = "hibou.WindowManager";
    static components = { ManagedWindow };

    wm = plugin(WindowManagerPlugin);
}
