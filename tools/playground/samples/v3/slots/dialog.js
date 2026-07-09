import { Component, useProps, t } from "@odoo/owl";

export class Dialog extends Component {
    static template = "example.Dialog";
    props = useProps({ title: t.string(), onClose: t.function().optional() })

    close() {
        if (this.props.onClose) {
            this.props.onClose();
        }
    }
}