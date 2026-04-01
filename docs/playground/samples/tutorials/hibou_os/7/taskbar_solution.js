import { Component, plugin, props, types as t } from "@odoo/owl";
import { WindowManagerPlugin } from "./window/window_manager_plugin";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";

    props = props({
        apps: t.array(),
    });

    wm = plugin(WindowManagerPlugin);

    get systrayItems() {
        return this.props.apps.flatMap((app) => app.systrayItems || []);
    }
}
