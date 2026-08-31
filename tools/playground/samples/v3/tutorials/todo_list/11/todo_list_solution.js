import { Component, signal, proxy, computed, providePlugins, usePlugin } from "@odoo/owl";
import { TodoItem } from "./todo_item";
import { TodoListPlugin } from "./todo_list_plugin";
import { useAutofocus } from "./utils";

export class TodoList extends Component {
    static template = "tutorial.TodoList";
    static components = { TodoItem };

    input = signal.ref();

    viewPrefs = proxy({
        filter: { status: "all" },
        sort: { by: "id", direction: "asc" },
    });

    visibleTodos = computed(() => {
        let todos = this.todoList.todos();
        const { status } = this.viewPrefs.filter;
        if (status !== "all") {
            const wantCompleted = status === "completed";
            todos = todos.filter((todo) => todo.completed() === wantCompleted);
        }
        const { by, direction } = this.viewPrefs.sort;
        const sorted = [...todos].sort((a, b) => {
            const cmp = by === "text" ? a.text.localeCompare(b.text) : a.id - b.id;
            return direction === "asc" ? cmp : -cmp;
        });
        return sorted;
    });

    setup() {
        providePlugins([TodoListPlugin]);
        this.todoList = usePlugin(TodoListPlugin);
        useAutofocus(this.input);
    }

    addTodo(ev) {
        if (ev.type === "click" || ev.key === "Enter") {
            const input = ev.type === "click" ? ev.target.previousElementSibling : ev.target;
            this.todoList.addTodo(input.value);
            input.value = "";
        }
    }

    toggleSortDirection() {
        this.viewPrefs.sort.direction = this.viewPrefs.sort.direction === "asc" ? "desc" : "asc";
    }

    sortDirectionLabel() {
        return this.viewPrefs.sort.direction === "asc" ? "↑" : "↓";
    }
}
