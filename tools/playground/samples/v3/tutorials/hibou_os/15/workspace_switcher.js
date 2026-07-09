import { Component, usePlugin } from "@odoo/owl";
import { WindowManagerPlugin } from "./window/window_manager_plugin";

export class WorkspaceSwitcher extends Component {
    static template = "hibou.WorkspaceSwitcher";

    wm = usePlugin(WindowManagerPlugin);
}
