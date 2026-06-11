import { Component, xml, signal } from "@odoo/owl";

export class BrowserApp extends Component {
    static template = xml`
      <div class="browser-app">
        <input class="browser-url" t-model="this.url"/>
        <iframe t-att-src="this.url()"/>
      </div>`;

    url = signal("https://en.wikipedia.org");
}
