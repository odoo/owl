import { Component } from "@odoo/owl";
import { Taskbar } from "./taskbar";
import { Window } from "./window";

export class Hibou extends Component {
    static template = "hibou.Hibou";
    static components = { Taskbar, Window };
}
