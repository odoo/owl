import { Component, plugin } from "@odoo/owl";
import { Window } from "./window";
import { WindowManagerPlugin } from "./window_manager_plugin";

export class WindowManager extends Component {
    static template = "hibou.WindowManager";
    static components = { Window };

    wm = plugin(WindowManagerPlugin);
}
