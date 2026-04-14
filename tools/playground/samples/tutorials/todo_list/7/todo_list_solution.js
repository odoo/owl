import { Component, signal, useEffect } from "@odoo/owl";
import { TodoItem } from "./todo_item";
import { useAutofocus } from "./utils";

export class TodoList extends Component {
    static template = "tutorial.TodoList";
    static components = { TodoItem };

    nextId = 4;
    input = signal(null);

    todos = signal.Array([
        { id: 1, text: "Buy milk", completed: signal(false) },
        { id: 2, text: "Clean the house", completed: signal(true) },
        { id: 3, text: "Walk the dog", completed: signal(false) },
    ]);

    setup() {
        useAutofocus(this.input);
        useEffect(() => {
            const todos = this.todos().map((todo) => ({
                text: todo.text,
                completed: todo.completed(),
            }));
            console.log("todos changed:", todos);
        });
    }

    addTodo(ev) {
        if (ev.type === "click" || ev.key === "Enter") {
            const input = ev.type === "click" ? ev.target.previousElementSibling : ev.target;
            const text = input.value.trim();
            if (text) {
                this.todos().push({ id: this.nextId++, text, completed: signal(false) });
                input.value = "";
            }
        }
    }

    deleteTodo(todo) {
        const index = this.todos().indexOf(todo);
        if (index !== -1) {
            this.todos().splice(index, 1);
        }
    }
}
