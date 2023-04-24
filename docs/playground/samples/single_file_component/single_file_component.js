// This example illustrates how one can write Owl components with
// inline templates.

import { Component, useState, xml, mount } from "@odoo/owl";

// Counter component
class Counter extends Component {
  static template = xml`
    <button t-on-click="() => state.value++">
      Click! [<t t-esc="state.value"/>]
    </button>`;

  state = useState({ value: 0 })
}

// Root
class Root extends Component {
  static template = xml`
    <div>
      <Counter/>
      <Counter/>
    </div>`;
  
  static components = { Counter };
}

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true});
