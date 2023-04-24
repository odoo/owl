// We show here how slots can be used to create generic components.
// In this example, the Card component is basically only a container. It is not
// aware of its content. It just knows where it should be (with t-slot).
// The parent component define the content with t-set-slot.
//
// Note that the t-on-click event, defined in the Root template, is executed in
// the context of the Root component, even though it is inside the Card component
import { Component, useState, mount } from "@odoo/owl";

class Card extends Component {
  static template = "Card";
  
  setup() {
    this.state = useState({ showContent: true });
  }

  toggleDisplay() {
    this.state.showContent = !this.state.showContent;
  }
}

class Counter extends Component {
  static template = "Counter";
  
  setup() {
    this.state = useState({val: 1});
  }

  inc() {
    this.state.val++;
  }
}

// Main root component
class Root extends Component {
  static template = "Root"
  static components = { Card, Counter };
  
  setup() {
    this.state = useState({a: 1, b: 3});
  }

  inc(key, delta) {
    this.state[key] += delta;
  }
}

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true});
