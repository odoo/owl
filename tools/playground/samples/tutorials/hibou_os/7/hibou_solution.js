import { Component, providePlugins, props, types as t } from "@odoo/owl";
import { Taskbar } from "./taskbar";
import { WindowManager } from "./window/window_manager";
import { WindowManagerPlugin } from "./window/window_manager_plugin";

export class Hibou extends Component {
    static template = "hibou.Hibou";
    static components = { Taskbar, WindowManager };

    props = props({
        apps: t.array(),
    });

    setup() {
        providePlugins([WindowManagerPlugin]);
    }
}
