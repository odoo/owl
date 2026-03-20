import { Component } from "@odoo/owl";
import { TodoItem } from "./todo_item";

export class TodoList extends Component {
    static template = "tutorial.TodoList";
    static components = { TodoItem };

    todos = [
        { id: 1, text: "Buy milk", completed: false },
        { id: 2, text: "Clean the house", completed: true },
        { id: 3, text: "Walk the dog", completed: false },
    ];
}
