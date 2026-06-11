import { Component } from "@odoo/owl";

export class TodoList extends Component {
    static template = "tutorial.TodoList";

    todos = [
        { id: 1, text: "Buy milk", completed: false },
        { id: 2, text: "Clean the house", completed: true },
        { id: 3, text: "Walk the dog", completed: false },
    ];
}
