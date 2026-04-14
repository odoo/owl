import { Component, signal } from "@odoo/owl";
import { TodoItem } from "./todo_item";

export class TodoList extends Component {
    static template = "tutorial.TodoList";
    static components = { TodoItem };

    nextId = 4;

    todos = signal.Array([
        { id: 1, text: "Buy milk", completed: false },
        { id: 2, text: "Clean the house", completed: true },
        { id: 3, text: "Walk the dog", completed: false },
    ]);

    addTodo(ev) {
        if (ev.type === "click" || ev.key === "Enter") {
            const input = ev.type === "click" ? ev.target.previousElementSibling : ev.target;
            const text = input.value.trim();
            if (text) {
                this.todos().push({ id: this.nextId++, text, completed: false });
                input.value = "";
            }
        }
    }
}
