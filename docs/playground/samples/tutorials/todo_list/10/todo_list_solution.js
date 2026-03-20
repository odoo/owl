import { Component, signal, providePlugins, plugin } from "@odoo/owl";
import { TodoItem } from "./todo_item";
import { TodoListPlugin } from "./todo_list_plugin";
import { useAutofocus } from "./utils";

export class TodoList extends Component {
    static template = "tutorial.TodoList";
    static components = { TodoItem };

    input = signal(null);

    setup() {
        providePlugins([TodoListPlugin]);
        this.todoList = plugin(TodoListPlugin);
        useAutofocus(this.input);
    }

    addTodo(ev) {
        if (ev.type === "click" || ev.key === "Enter") {
            const input = ev.type === "click" ? ev.target.previousElementSibling : ev.target;
            this.todoList.addTodo(input.value);
            input.value = "";
        }
    }
}
