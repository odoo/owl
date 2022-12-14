/** @odoo-module **/

import { Component } from "@odoo/owl";

export default class TreeElement extends Component {
    
    static template = "devtools.tree_element";

    static props = ['name', 'attributes', 'children', 'path'];

    static components = { TreeElement };

    toggleEvent(ev){
        ev.target.parentElement.querySelector(".nested").classList.toggle("active");
        ev.target.classList.toggle("caret-down");
    }

}
