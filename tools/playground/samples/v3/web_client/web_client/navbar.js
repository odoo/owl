import { Component, usePlugin } from "@odoo/owl";
import { MenuPlugin } from "./menu_plugin";

export class Navbar extends Component {
    static template = "demo.Navbar";
    menuPlugin = usePlugin(MenuPlugin);
}
