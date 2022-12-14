import { Component } from "@odoo/owl";
import TreeElement from './tree_element'

export default class Tree extends Component {
    
    static template = "devtools.tree";

    static components = { TreeElement };

}
