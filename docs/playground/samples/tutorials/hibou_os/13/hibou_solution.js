import { Component, providePlugins } from "@odoo/owl";
import { Taskbar } from "./taskbar";
import { WindowManager } from "./window/window_manager";
import { WindowManagerPlugin } from "./window/window_manager_plugin";
import { pluginRegistry } from "./registries";

export class Hibou extends Component {
    static template = "hibou.Hibou";
    static components = { Taskbar, WindowManager };

    setup() {
        const appPlugins = pluginRegistry.items();
        providePlugins([WindowManagerPlugin, ...appPlugins]);
    }
}
