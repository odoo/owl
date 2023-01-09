
const {Component, useState, onWillStart} = owl
import { ObjectTreeElement } from './object_tree_element'
import { Subscriptions } from './subscriptions';

export class DetailsWindow extends Component {
  setup(){
  }

  get componentName() { return this.props.activeComponent.name; }
  get activeProperties(){ return this.props.activeComponent.properties; }
  get activeSubscriptions(){ return this.props.activeComponent.subscriptions; }

  static props = ['activeComponent', 'updateObjectTreeElement', 'expandSubscriptionsKeys', 'editReactiveState', 'updateBag'];
  
  static template = "devtools.details_window";

  static components = { ObjectTreeElement, Subscriptions };
}


