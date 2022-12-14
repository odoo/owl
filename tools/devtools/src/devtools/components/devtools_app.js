/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import Tab from './tab'
import Tree from './components_tree/tree'
import Events from './events/events'
import Dashboard from './dashboard/dashboard'



export class DevtoolsApp extends Component {
    setup(){
        this.state = useState({
            page: 'Tree',
        });
    }
    
    static template = "devtools.devtools_app";

    static components = { Tab, Tree, Events, Dashboard };

    switchTab(componentName) {
        console.log("switchTab: " + componentName);
        this.state.page = componentName
    };

    get selectPage() { 
        switch (this.state.page) {
            case 'Events':
                return Events;
            case 'Tree':
                return Tree;
            case 'Dashboard':
                return Dashboard;
            default: 
                return Events;
        }
    }

}
