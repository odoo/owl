import { Component, signal } from "@odoo/owl";

export class Counter extends Component {
    static template = "tutorial.Counter";

    count = signal(0);

    increment() {
        this.count.set(this.count() + 1);
    }

    decrement() {
        this.count.set(this.count() - 1);
    }
}
