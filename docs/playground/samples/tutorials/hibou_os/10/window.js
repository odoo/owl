import { Component, props, types as t } from "@odoo/owl";

export class Window extends Component {
    static template = "hibou.Window";

    props = props({
        title: t.string(),
        "onClose?": t.function(),
        "x?": t.signal(),
        "y?": t.signal(),
        "zIndex?": t.signal(),
        "component?": t.function(),
    });

    startDrag(ev) {
        const startX = ev.clientX;
        const startY = ev.clientY;
        const origX = this.props.x();
        const origY = this.props.y();

        const onMouseMove = (moveEv) => {
            this.props.x.set(origX + moveEv.clientX - startX);
            this.props.y.set(origY + moveEv.clientY - startY);
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    }
}
