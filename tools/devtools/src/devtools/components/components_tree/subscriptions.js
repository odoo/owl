
const { Component, useState, onMounted, onWillUpdateProps } = owl
import { ObjectTreeElement } from './object_tree_element'

export class Subscriptions extends Component {
  setup(){
  }

  get subscriptions() { return this.props.subscriptions }

  expandKeys(event, index){
    this.props.expandSubscriptionsKeys(index);
  }

  static props = ['subscriptions', 'updateObjectTreeElement', 'expandSubscriptionsKeys', 'editReactiveState'];

  static template = "devtools.subscriptions";

  static components = { ObjectTreeElement };
}



