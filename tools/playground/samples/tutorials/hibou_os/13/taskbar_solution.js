import { Component, plugin } from "@odoo/owl";
import { WindowManagerPlugin } from "./window/window_manager_plugin";
import { menuItemRegistry, systrayItemRegistry } from "./registries";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";

    wm = plugin(WindowManagerPlugin);
    menuItems = menuItemRegistry.items;
    systrayItems = systrayItemRegistry.items;
}
