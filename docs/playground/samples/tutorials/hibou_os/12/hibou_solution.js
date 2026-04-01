import { Component, Plugin, providePlugins, props, types as t, assertType } from "@odoo/owl";
import { Taskbar } from "./taskbar";
import { WindowManager } from "./window/window_manager";
import { WindowManagerPlugin } from "./window/window_manager_plugin";

const APP_SCHEMA = t.object({
    name: t.string,
    icon: t.string,
    window: t.constructor(Component),
    "systrayItems?": t.array(t.constructor(Component)),
    "plugins?": t.array(t.constructor(Plugin)),
});

export class Hibou extends Component {
    static template = "hibou.Hibou";
    static components = { Taskbar, WindowManager };

    props = props({
        apps: t.array(),
    });

    setup() {
        for (const app of this.props.apps) {
            assertType(app, APP_SCHEMA);
        }
        const appPlugins = this.props.apps.flatMap((app) => app.plugins || []);
        providePlugins([WindowManagerPlugin, ...appPlugins]);
    }
}
