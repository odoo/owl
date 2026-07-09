import { Component, usePlugin } from "@odoo/owl";
import { WindowManagerPlugin } from "./window/window_manager_plugin";
import { menuItemRegistry, systrayItemRegistry } from "./registries";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";

    wm = usePlugin(WindowManagerPlugin);
    menuItems = menuItemRegistry.items;
    systrayItems = systrayItemRegistry.items;
}
