// This example illustrate how the t-model directive can be used to synchronize
// data between html inputs (and select/textareas) and the state of a component.
// Note that there are two controls with t-model="color": they are totally
// synchronized.
import { Component, signal, mount } from "@odoo/owl";

class Form extends Component {
  static template = "Form";

  text = signal("");
  othertext = signal("");
  number = signal(11);
  color = signal("");
  bool = signal(false);
}

// Application setup
mount(Form, document.body, { templates: TEMPLATES, dev: true });
