import { Component, signal, mount, useEffect, computed } from "@odoo/owl";

/**
 * This example illustrates how the t-model directive can be used to synchronize
 * data between html inputs (and select/textareas) and the state of a component.
 * Note that there are two controls with t-model="color": they are totally
 * synchronized.
 */

class Form extends Component {
  static template = "example.Form";

  text = signal("some text");
  number = signal(11);
  color = signal("");
  bool = signal(false);

  // we can derive some value
  uppercaseText = computed(() => this.text().toUpperCase());

  amount = signal(2);
  // we can define computed values with a setter
  doubleAmount = computed(() => 2 * this.amount(), {
    // we have to use an arrow function here to avoid redefining 'this'
    set: (v) => {
      this.amount.set(v / 2);
    },
  });

  setup() {
    useEffect(() => {
      // we can react to state change with an effect
      console.log(this.text());
    });
  }
}

// Application setup
mount(Form, document.body, { templates: TEMPLATES, dev: true });
