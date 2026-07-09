import { Component, usePlugin, computed } from "@odoo/owl";
import { Window } from "./window";
import { WindowManagerPlugin } from "./window_manager_plugin";

export class WindowManager extends Component {
    static template = "hibou.WindowManager";
    static components = { Window };

    wm = usePlugin(WindowManagerPlugin);

    cubeStyle = computed(() => {
        const angle = (this.wm.currentWorkspace() - 1) * -90;
        return `transform: translateZ(-50vw) rotateY(${angle}deg)`;
    });

    windowsForWorkspace(ws) {
        return this.wm.windows().filter((w) => w.workspace === ws);
    }
}
