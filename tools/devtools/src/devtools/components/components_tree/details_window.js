
import { Component, useState, onWillStart } from "@odoo/owl";
import { Property } from './property'

export class DetailsWindow extends Component {
  setup(){
  }

  get componentName() { return this.props.activeComponent.name; }
  get activeProperties(){ return this.props.activeComponent.properties; }

  static props = ['activeComponent', 'updateProperty'];
  
  static template = "devtools.details_window";

  static components = { Property };
}


