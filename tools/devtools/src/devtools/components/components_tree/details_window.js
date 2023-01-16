
const {Component, useState, onWillStart} = owl
import { ObjectTreeElement } from './object_tree_element'
import { Subscriptions } from './subscriptions';

export class DetailsWindow extends Component {
  setup(){
  }

  get componentName() { return this.props.activeComponent.name; }
  get activeProperties(){ return this.props.activeComponent.properties; }
  get activeSubscriptions(){ return this.props.activeComponent.subscriptions; }
  get activeEnvElements(){ return this.props.activeComponent.env; }

  refreshComponent(){
    this.props.refreshComponent();
  }

  logComponentInConsole(type){
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.sendObjectToConsole("'+ this.props.activeComponent.path +'", "'+ type +'")';
    chrome.devtools.inspectedWindow.eval(script);
  }

  inspectComponentInDOM(){
    console.log(this.props.activeComponent)
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectComponent("'+ this.props.activeComponent.path +'")';
    chrome.devtools.inspectedWindow.eval(script);
  }

  static props = ['activeComponent', 'updateObjectTreeElement', 'expandSubscriptionsKeys', 'editObjectTreeElement', 'updateBag'];
  
  static template = "devtools.DetailsWindow";

  static components = { ObjectTreeElement, Subscriptions };
}


