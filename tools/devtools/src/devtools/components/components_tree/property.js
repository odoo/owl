
import { Component, useState, onMounted, onWillUpdateProps } from "@odoo/owl";

export class Property extends Component {
  setup(){
    debugger;
  }
  get content(){
    return this.props.property;
  }

  toggleDisplay(ev){
    ev.stopPropagation();
    this.props.toggled = !this.props.toggled;
    this.props.children.forEach(child => {
        this.swapDisplay(child, this.props.toggled, this.props.toggled)
    });
    this.props.updateProperty(this.props);
  }

  swapDisplay(element, toggled, display){
    if(!display){
        element.display = false;
    }
    else if(toggled){
        element.display = true;
    }
    element.children.forEach(child => {
        this.swapDisplay(child, element.toggled, element.display)
    });
  }

  static props = ['name', 'property', 'children', 'display', 'toggled', 'depth', 'propertyType', 'hasChildren'];

  static template = "devtools.property";

  static components = { Property };
}



