import { Component, signal, xml } from "@odoo/owl";

export class App extends Component {
  static template = xml`
    <main>
      <h1>Hello, Owl</h1>
      <button t-on-click="() => this.count.set(this.count() + 1)">
        Count: <t t-out="this.count()"/>
      </button>
    </main>
  `;

  count = signal(0);
}
