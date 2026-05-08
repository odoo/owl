import { Component, mount, xml, signal } from "@odoo/owl";
import { Dialog } from "./dialog";

// Slots: a Dialog is a generic shell that the parent fills in.
// - The default slot is the dialog body — anything between
//   <Dialog>...</Dialog> renders there.
// - The named "footer" slot is a separate insertion point: set it with
//   `<t t-set-slot="footer">...</t>`.
// Slot content is evaluated in the *parent's* scope (Counter is the parent's
// component, `this.toggle` refers to the parent's method).

class Counter extends Component {
    static template = xml`<button t-on-click="this.increment" t-out="this.value()"/>`;
    
    value = signal(0);

    increment() {
        this.value.set(this.value() + 1);
    }
}

class Root extends Component {
    static components = { Dialog, Counter };
    static template = xml`
        <button t-on-click="() => this.toggle(true)">Show Dialog</button>
        <t t-if="this.showDialog()">
          <Dialog title="'Hello'" onClose="() => this.toggle(false)">
            <p>Some content here.</p>
            <p>Even a component: <Counter/></p>
            <t t-set-slot="footer">
              <em>Footer rendered in the parent's scope.</em>
            </t>
          </Dialog>
        </t>`;

    showDialog = signal(false);

    toggle(visible) {
        this.showDialog.set(visible);
    }
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
