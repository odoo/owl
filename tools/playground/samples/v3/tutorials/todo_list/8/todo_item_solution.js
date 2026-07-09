import { Component, useProps, t, usePlugin } from "@odoo/owl";
import { TodoListPlugin } from "./todo_list_plugin";

export class TodoItem extends Component {
    static template = "tutorial.TodoItem";

    props = useProps({
        todo: t.object({ id: t.number(), text: t.string(), completed: t.signal() }),
    });

    todoList = usePlugin(TodoListPlugin);
}
