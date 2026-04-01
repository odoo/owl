import { Component, props, types as t, useEffect, onMounted } from "@odoo/owl";
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
        "width?": t.number,
        "height?": t.number,
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
        onMounted(() => {
            const el = this.dnd.root();
            if (el) {
                if (this.props.width) el.style.width = this.props.width + "px";
                if (this.props.height) el.style.height = this.props.height + "px";
            }
        });
    }
}
