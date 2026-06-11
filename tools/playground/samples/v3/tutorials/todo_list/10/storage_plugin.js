import { Plugin } from "@odoo/owl";

export class StoragePlugin extends Plugin {
    save(key, data) {
        localStorage.setItem(key, data);
    }

    load(key) {
        return localStorage.getItem(key);
    }
}
