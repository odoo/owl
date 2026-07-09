import { Component, useProps, t } from "@odoo/owl";
import { Clock } from "./clock";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";
    static components = { Clock };

    props = useProps({
        onClockClick: t.function().optional(),
    });
}
