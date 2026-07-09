import { Component, usePlugin, useProps, t } from "@odoo/owl";
import { WindowManagerPlugin } from "./window/window_manager_plugin";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";

    props = useProps({
        apps: t.array(),
    });

    wm = usePlugin(WindowManagerPlugin);

    get systrayItems() {
        return this.props.apps.flatMap((app) => app.systrayItems || []);
    }
}
