import { Plugin, signal } from "@odoo/owl";

export class NotepadPlugin extends Plugin {
    text = signal("");
}
