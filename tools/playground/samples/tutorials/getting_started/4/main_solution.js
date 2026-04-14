import { Component, mount, xml, signal, computed } from "@odoo/owl";

class Root extends Component {
    static template = xml`
      <div class="form">
        <input t-model="this.name" placeholder="Name"/>
        <input t-model="this.email" placeholder="Email"/>
        <div t-out="this.isValid() ? 'Valid' : 'Invalid'"/>
      </div>`;

    name = signal("");
    email = signal("");

    isValid = computed(() => {
        return this.name() && this.email() && this.email().includes("@");
    });
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
