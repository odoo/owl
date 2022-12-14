import { Component } from "@odoo/owl";

export default class Tab extends Component {

    static props = ['name', 'active', 'componentName','switchTab']
    
    static template = "devtools.tab";

    selectTab(ev){
        console.log("selectTab " + this.props.componentName);
        this.props.switchTab(this.props.componentName);
    }

}
