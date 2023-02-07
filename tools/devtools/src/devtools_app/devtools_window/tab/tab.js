/** @odoo-module **/

const { Component } = owl

export class Tab extends Component {

  static props = ['name', 'active', 'componentName','switchTab']
  
  static template = "devtools.Tab";

  selectTab(ev){
    this.props.switchTab(this.props.componentName);
  }

}
