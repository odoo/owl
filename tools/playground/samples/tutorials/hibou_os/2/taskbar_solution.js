import { Component } from "@odoo/owl";
import { Clock } from "./clock";

export class Taskbar extends Component {
    static template = "hibou.Taskbar";
    static components = { Clock };
}
