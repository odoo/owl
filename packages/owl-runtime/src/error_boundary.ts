import { Component } from "./component";
import { onError } from "./lifecycle_hooks";
import { signal } from "./reactivity/signal";
import { xml } from "./template_set";

export class ErrorBoundary extends Component {
  static template = xml`
    <t t-if="this.error()">
      <t t-call-slot="fallback" error="this.error()" retry="this.retry"/>
    </t>
    <t t-else="">
      <t t-call-slot="default"/>
    </t>
  `;

  error = signal<any>(null);
  retry = () => this.error.set(null);

  setup() {
    onError((error) => this.error.set(error));
  }
}
