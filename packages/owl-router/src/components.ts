// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
//
// Two opt-in components for declarative routing inside templates:
//
//   <Link href="/users/42">User 42</Link>
//     Renders an <a> tag with a real href (so right-click / ctrl-click /
//     copy-url all behave normally) and intercepts the click to soft-navigate
//     via the router.
//
//   <RouteSwitch select="(state) => state.page">
//     <t t-set-slot="home"><Home/></t>
//     <t t-set-slot="users"><Users/></t>
//     <t t-set-slot="default"><NotFound/></t>
//   </RouteSwitch>
//     Renders one named slot picked by the `select` callback. Falls back to
//     a `default` slot if the picked name is unknown.
//
// Both components read state via `useRouter()`, so they're reactive to
// state-signal changes through the standard component reactivity.
// -----------------------------------------------------------------------------

import { Component, props, types as t, xml } from "@odoo/owl-runtime";
import { useRouter } from "./hooks";

// -----------------------------------------------------------------------------
// Link
// -----------------------------------------------------------------------------

export class Link extends Component {
  static template = xml`
    <a t-att-href="this.props.href"
       t-att-class="this.props.class"
       t-att-title="this.props.title"
       t-on-click="this.onClick">
      <t t-call-slot="default"/>
    </a>`;

  router = useRouter();
  props = props({
    href: t.string(),
    "replace?": t.boolean(),
    "class?": t.string(),
    "title?": t.string(),
    "slots?": t.any(),
  });

  onClick(ev: MouseEvent) {
    if (ev.defaultPrevented) return;
    if (ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    this.router.navigate(this.props.href, this.props.replace ? { replace: true } : undefined);
  }
}

// -----------------------------------------------------------------------------
// RouteSwitch
// -----------------------------------------------------------------------------

export class RouteSwitch extends Component {
  static template = xml`<t t-call-slot="{{this.activeSlot}}"/>`;

  router = useRouter();
  props = props({
    select: t.function(),
    "slots?": t.any(),
  });

  get activeSlot(): string {
    const name = this.props.select(this.router.state());
    return name in (this.props.slots ?? {}) ? name : "default";
  }
}
