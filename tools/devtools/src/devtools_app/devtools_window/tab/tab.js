/** @odoo-module **/

import { useStore } from "../../store/store";

const { Component } = owl

export class Tab extends Component {

  static props = ['name', 'active', 'componentName']
  
  static template = "devtools.Tab";

  setup(){
    this.store = useStore();
  }

  selectTab(ev){
    this.store.switchTab(this.props.componentName);
  }

}
