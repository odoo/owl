// This example illustrate how the t-model directive can be used to synchronize
// data between html inputs (and select/textareas) and the state of a component.
// Note that there are two controls with t-model="color": they are totally
// synchronized.
import { Component, useState, mount } from "@odoo/owl";

class Form extends Component {
  static template = "Form";

  setup() {
    this.state = useState({
      text: "",
      othertext: "",
      number: 11,
      color: "",
      bool: false
    });
  }
}

// Application setup
mount(Form, document.body, { templates: TEMPLATES, dev: true });
