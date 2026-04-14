import { Plugin, signal, useEffect } from "@odoo/owl";

export class TodoListPlugin extends Plugin {
    nextId = 4;

    todos = signal.Array([
        { id: 1, text: "Buy milk", completed: signal(false) },
        { id: 2, text: "Clean the house", completed: signal(true) },
        { id: 3, text: "Walk the dog", completed: signal(false) },
    ]);

    setup() {
        useEffect(() => {
            const todos = this.todos().map((todo) => ({
                text: todo.text,
                completed: todo.completed(),
            }));
            console.log("todos changed:", todos);
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
