import { Plugin, signal } from "@odoo/owl";
import { rpc } from "../core/rpc";

export class MenuPlugin extends Plugin {
    menus = signal([]);
    activeMenuId = signal(null);

    setup() {
        this.loadMenus();
    }

    async loadMenus() {
        const menus = await rpc("load_menus");
        this.menus.set(menus);
        if (menus.length > 0) {
            this.activeMenuId.set(menus[0].id);
        }
    }

    setMenu(id) {
        this.activeMenuId.set(id);
    }
}
