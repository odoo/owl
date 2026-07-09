import { Component, useProps, t } from "@odoo/owl";

export class TodoItem extends Component {
    static template = "tutorial.TodoItem";

    props = useProps({
        todo: t.object({ id: t.number(), text: t.string(), completed: t.boolean() }),
    });
}
