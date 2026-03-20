import { Component, props, types as t } from "@odoo/owl";
import { Clock } from "./clock";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";
    static components = { Clock };

    props = props({
        "onClockClick?": t.function(),
    });
}
