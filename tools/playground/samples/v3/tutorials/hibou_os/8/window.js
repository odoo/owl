import { Component, useProps, t } from "@odoo/owl";

export class Window extends Component {
    static template = "hibou.Window";

    props = useProps({
        title: t.string(),
        onClose: t.function().optional(),
        x: t.number().optional(),
        y: t.number().optional(),
        zIndex: t.signal().optional(),
    });
}
