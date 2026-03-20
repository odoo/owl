import { Component } from "@odoo/owl";
import { Taskbar } from "./taskbar";

export class Hibou extends Component {
    static template = "hibou.Hibou";
    static components = { Taskbar };
}
