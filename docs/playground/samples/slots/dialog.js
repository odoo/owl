import { Component, props, types as t } from "@odoo/owl";

export class Dialog extends Component {
    static template = "example.Dialog";
    props = props({ title: t.string, "onClose?": t.function()})

    close() {
        if (this.props.onClose) {
            this.props.onClose();
        }
    }
}