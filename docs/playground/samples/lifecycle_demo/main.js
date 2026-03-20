import { Component, mount, signal } from "@odoo/owl";
import { ChatWindow } from "./chat_window";
import { useLog } from "./helpers";

class Root extends Component {
    static components = { ChatWindow };
    static template = "example.Root";

    isOpen = signal(false);

    setup() {
        useLog("Root");
    }

    toggle() {
        this.isOpen.set(!this.isOpen());
    }
}
mount(Root, document.body, { templates: TEMPLATES });
