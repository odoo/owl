import { Plugin, signal } from "@odoo/owl";

export class WindowManagerPlugin extends Plugin {
    nextId = 1;
    windows = signal.Array([]);

    open(title, component) {
        this.windows().push({
            id: this.nextId++,
            title,
            component,
            x: 60 + this.windows().length * 30,
            y: 60 + this.windows().length * 30,
        });
    }

    close(id) {
        const index = this.windows().findIndex((w) => w.id === id);
        if (index !== -1) {
            this.windows().splice(index, 1);
        }
    }
}
