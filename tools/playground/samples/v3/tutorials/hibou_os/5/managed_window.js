import { Component, useProps, t, usePlugin } from "@odoo/owl";
import { Window } from "./window";
import { WindowManagerPlugin } from "./window_manager_plugin";

export class ManagedWindow extends Component {
    static template = "hibou.ManagedWindow";
    static components = { Window };

    props = useProps({
        window: t.object(),
    });

    wm = usePlugin(WindowManagerPlugin);
}
