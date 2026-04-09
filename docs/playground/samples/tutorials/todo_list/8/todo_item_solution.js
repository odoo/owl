import { Component, props, types as t, plugin } from "@odoo/owl";
import { TodoListPlugin } from "./todo_list_plugin";

export class TodoItem extends Component {
    static template = "tutorial.TodoItem";

    props = props({
        todo: t.object({ id: t.number(), text: t.string(), completed: t.signal() }),
    });

    todoList = plugin(TodoListPlugin);
}
