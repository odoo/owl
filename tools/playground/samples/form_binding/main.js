// Two-way binding via `t-model` on inputs, selects, checkboxes, radios.
// Both `t-model="this.color"` controls stay in sync.
// `computed` derives values from signals; `computed` with a `set` makes
// a derived value writable (here: `doubleAmount` writes back to `amount`).
//
// Try: type into the text input, change selects, edit "Double Amount".
import { Component, signal, computed, mount, useEffect } from "@odoo/owl";

class Form extends Component {
  static template = "example.Form";

  text = signal("some text");
  number = signal(11);
  color = signal("");
  bool = signal(false);

  uppercaseText = computed(() => this.text().toUpperCase());

  amount = signal(2);
  doubleAmount = computed(() => 2 * this.amount(), {
    set: (v) => this.amount.set(v / 2),
  });

  setup() {
    useEffect(() => {
      console.log("text changed:", this.text());
    });
  }
}

mount(Form, document.body, { templates: TEMPLATES, dev: true });
