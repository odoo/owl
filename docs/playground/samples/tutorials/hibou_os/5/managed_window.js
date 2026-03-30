import { Component, props, types as t, plugin } from "@odoo/owl";
import { Window } from "./window";
import { WindowManagerPlugin } from "./window_manager_plugin";

export class ManagedWindow extends Component {
    static template = "hibou.ManagedWindow";
    static components = { Window };

    props = props({
        window: t.object(),
    });

    wm = plugin(WindowManagerPlugin);
}
