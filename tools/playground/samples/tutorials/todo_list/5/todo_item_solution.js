import { Component, props, types as t } from "@odoo/owl";

export class TodoItem extends Component {
    static template = "tutorial.TodoItem";

    props = props({
        todo: t.object({ id: t.number(), text: t.string(), completed: t.signal() }),
    });
}
