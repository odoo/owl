import { Plugin, signal, computed, useEffect, plugin } from "@odoo/owl";
import { StoragePlugin } from "../storage_plugin";

export class TodoListPlugin extends Plugin {
    nextId = 4;

    todos = signal.Array([
        { id: 1, text: "Buy milk", completed: signal(false) },
        { id: 2, text: "Clean the house", completed: signal(true) },
        { id: 3, text: "Walk the dog", completed: signal(false) },
    ]);

    remaining = computed(() => {
        return this.todos().filter((todo) => !todo.completed()).length;
    });

    storage = plugin(StoragePlugin);

    setup() {
        const saved = this.storage.load("todos");
        if (saved) {
            const data = JSON.parse(saved);
            this.nextId = data.reduce((max, t) => Math.max(max, t.id + 1), 1);
            this.todos.set(data.map((t) => ({
                id: t.id,
                text: t.text,
                completed: signal(t.completed),
            })));
        }

        useEffect(() => {
            const data = this.todos().map((todo) => ({
                id: todo.id,
                text: todo.text,
                completed: todo.completed(),
            }));
            this.storage.save("todos", JSON.stringify(data));
        });
    }

    addTodo(text) {
        text = text.trim();
        if (text) {
            this.todos().push({ id: this.nextId++, text, completed: signal(false) });
        }
    }

    deleteTodo(todo) {
        const index = this.todos().indexOf(todo);
        if (index !== -1) {
            this.todos().splice(index, 1);
        }
    }
}
