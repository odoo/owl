import { Component, useProps, t, useEffect } from "@odoo/owl";
import { useDragAndDrop } from "../utils/drag_and_drop";

export class Window extends Component {
    static template = "hibou.Window";

    props = useProps({
        title: t.string(),
        onClose: t.function().optional(),
        x: t.signal().optional(),
        y: t.signal().optional(),
        zIndex: t.signal().optional(),
        component: t.function().optional(),
    });

    dnd = useDragAndDrop(this.props.x, this.props.y);

    setup() {
        useEffect(() => {
            const el = this.dnd.root();
            const zIndex = this.props.zIndex;
            if (el && zIndex) {
                el.style.zIndex = zIndex();
            }
        });
    }
}
