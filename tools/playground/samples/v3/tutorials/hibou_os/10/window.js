import { Component, useProps, t } from "@odoo/owl";

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
