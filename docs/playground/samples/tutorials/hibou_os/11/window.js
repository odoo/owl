import { Component, props, types as t, useEffect } from "@odoo/owl";
import { useDragAndDrop } from "../utils/drag_and_drop";

export class Window extends Component {
    static template = "hibou.Window";

    props = props({
        title: t.string,
        "onClose?": t.function(),
        "x?": t.signal(),
        "y?": t.signal(),
        "zIndex?": t.signal(),
        "component?": t.function(),
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
