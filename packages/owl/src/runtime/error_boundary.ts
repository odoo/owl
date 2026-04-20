import { Component } from "./component";
import { onError } from "./lifecycle_hooks";
import { props } from "./props";
import { signal } from "./reactivity/signal";
import { xml } from "./template_set";
import { types as t } from "./types";

export class ErrorBoundary extends Component {
  static template = xml`
    <t t-if="this.props.error()">
      <t t-call-slot="fallback"/>
    </t>
    <t t-else="">
      <t t-call-slot="default"/>
    </t>
  `;

  props = props({ "error?": t.signal() }, { error: signal<any>(null) });

  setup() {
    onError((e) => this.props.error.set(e));
  }
}
