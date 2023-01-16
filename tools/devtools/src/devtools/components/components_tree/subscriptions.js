
const { Component, markup, useState, onMounted, onWillUpdateProps } = owl
import { ObjectTreeElement } from './object_tree_element'


export class Subscriptions extends Component {
  setup(){

  }

  get subscriptions() { return this.props.subscriptions }

  keysContent(index) {
    const keys = this.props.subscriptions[index].keys;
    let content = JSON.stringify(keys);
    const maxLength = 50;
    content = content.replace(/,/g, ', ');
    if(content.length > maxLength){
      content = content.slice(0, content.lastIndexOf(',', maxLength-5)) + ", ...]";
    }
    content = markup('<div class="key_name">' + content + '</div>');
    return content;
  }

  expandKeys(event, index){
    this.props.expandSubscriptionsKeys(index);
  }

  static props = ['subscriptions', 'updateObjectTreeElement', 'expandSubscriptionsKeys', 'editObjectTreeElement', 'updateBag'];

  static template = "devtools.Subscriptions";

  static components = { ObjectTreeElement };
}



