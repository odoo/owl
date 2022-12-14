import { Component } from "@odoo/owl";

export default class TreeElement extends Component {
    
    static template = "devtools.tree_element";

    static props = ['tag', 'depth'];

}
