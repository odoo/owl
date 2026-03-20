import { Component, onWillStart, signal } from "@odoo/owl";
import { useLog } from "./helpers";

export class ChatWindow extends Component {
    static template = "example.ChatWindow";

    messages = signal.Array([]);
    input = signal("");
    nextId = 1;

    setup() {
        useLog("ChatWindow");
        onWillStart(async () => {
            // we simulate here some delay
            await new Promise(resolve => setTimeout(resolve, 1000));
        });
    }

    send() {
        const msg = this.input().trim();
        if (msg) {
            this.messages().push({
                id: this.nextId++,
                text: msg,
            });
        }
        this.input.set("");
    }
}
