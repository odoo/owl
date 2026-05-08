// Suspense: declarative loading state.
// While a child's `onWillStart` is pending, Owl renders the fallback slot.
// When the promise resolves, Owl swaps in the real content.
//
// Try: increase DELAY_MS, throw inside fakeFetch, toggle multiple times.
import { Component, mount, Suspense, onWillStart, signal, xml } from "@odoo/owl";

const DELAY_MS = 1000;
const fakeFetch = () =>
  new Promise((res) =>
    setTimeout(() => res(`fetched at ${new Date().toLocaleTimeString()}`), DELAY_MS)
  );

class Article extends Component {
  static template = xml`<article style="padding:8px;border:1px solid #ccc"><t t-out="this.body"/></article>`;
  body = "";

  setup() {
    onWillStart(async () => {
      this.body = await fakeFetch();
    });
  }
}

class Root extends Component {
  static components = { Suspense, Article };
  static template = xml`
    <button t-on-click="this.toggle">
      <t t-if="this.visible()">unmount</t>
      <t t-else="">mount</t>
    </button>
    <t t-if="this.visible()">
      <Suspense>
        <t t-set-slot="fallback">⏳ loading...</t>
        <Article/>
      </Suspense>
    </t>`;

  visible = signal(false);

  toggle() {
    this.visible.set(!this.visible());
  }
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
