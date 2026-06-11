import { Component, props, t } from "@odoo/owl";

export class Window extends Component {
    static template = "hibou.Window";

    props = props({
        title: t.string(),
        "onClose?": t.function(),
    });
}
