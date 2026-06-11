import { Plugin, signal } from "@odoo/owl";

export class WindowManagerPlugin extends Plugin {
    nextId = 1;
    nextZIndex = 1;
    windows = signal.Array([]);

    open(title, component) {
        this.windows().push({
            id: this.nextId++,
            title,
            component,
            x: signal(60 + this.windows().length * 30),
            y: signal(60 + this.windows().length * 30),
            zIndex: signal(this.nextZIndex++),
        });
    }

    close(id) {
        const index = this.windows().findIndex((w) => w.id === id);
        if (index !== -1) {
            this.windows().splice(index, 1);
        }
    }

    activate(id) {
        const win = this.windows().find((w) => w.id === id);
        if (win) {
            win.zIndex.set(this.nextZIndex++);
        }
    }
}
