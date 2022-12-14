/** @odoo-module **/

import { Component, useState} from "@odoo/owl";
import TreeElement from './tree_element'

export default class Tree extends Component {
    setup(){
        this.root = useState({
            name: "App",
            attributes: { id: "app" },
            path: "App",
            children: [
                {
                    name: "Tab1",
                    attributes: { id: "tab1" },
                    path: "App__Tab1",
                    children: [
                        {
                            name: "Content1",
                            attributes: { id: "content1" },
                            path: "App__Tab1__Content1",
                            children: []
                        }
                    ]
                },
                {
                    name: "Tab2",
                    attributes: { id: "Tab2" },
                    path: "App__Tab2",
                    children: [
                        {
                            name: "Content2",
                            attributes: { id: "Content2" },
                            path: "App__Tab2__Content2",
                            children: []
                        }
                    ]
                }
            ]
        });
    }
    
    static template = "devtools.tree";
    
    static components = { TreeElement };

}
