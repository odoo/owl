import { signal, useEffect, useListener } from "@odoo/owl";

export function useDragAndDrop(x, y) {
    const root = signal(null);
    const handle = signal(null);

    useEffect(() => {
        const el = root();
        if (el) {
            el.style.left = x() + "px";
            el.style.top = y() + "px";
        }
    });

    useListener(handle, "mousedown", (ev) => {
        const startX = ev.clientX;
        const startY = ev.clientY;
        const origX = x();
        const origY = y();

        const onMouseMove = (moveEv) => {
            x.set(origX + moveEv.clientX - startX);
            y.set(origY + moveEv.clientY - startY);
        };
        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    return { root, handle };
}
