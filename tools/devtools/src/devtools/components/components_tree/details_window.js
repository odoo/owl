
const {Component, useState, onWillStart} = owl
import { ObjectTreeElement } from './object_tree_element'
import { Subscriptions } from './subscriptions';

export class DetailsWindow extends Component {
  setup(){
  }

  refreshComponent(){
    this.props.refreshComponent();
  }

  logComponentInConsole(type){
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.sendObjectToConsole("'+ this.props.activeComponent.path +'", "'+ type +'")';
    chrome.devtools.inspectedWindow.eval(script);
  }

  inspectComponentInDOM(){
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectComponentDOM("'+ this.props.activeComponent.path +'")';
    chrome.devtools.inspectedWindow.eval(script);
  }

  inspectComponentSource(){
    const script = '__OWL__DEVTOOLS_GLOBAL_HOOK__.inspectComponentSource("'+ this.props.activeComponent.path +'")';
    chrome.devtools.inspectedWindow.eval(script);
  }

  static props = ['activeComponent', 'updateObjectTreeElement', 'expandSubscriptionsKeys', 'editObjectTreeElement', 'updateBag', 'width'];
  
  static template = "devtools.DetailsWindow";

  static components = { ObjectTreeElement, Subscriptions };
}


