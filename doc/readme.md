# OWL Documentation

Owl is a modern UI framework (~30kb gzipped, zero dependencies) written in TypeScript,
built by [Odoo](https://www.odoo.com/). It powers Odoo's web client, one of the largest
open-source business applications, but is equally suited for small projects and prototypes.

Key features:

- **Signal-based reactivity** — Explicit, composable, and debuggable state management
- **Plugin system** — Type-safe, composable sharing of state and services
- **Class-based components** — Familiar OOP patterns with ES6 classes
- **Declarative templates** — XML templates with a clean syntax
- **Async rendering** — Concurrent mode for smooth user experiences
- **No toolchain required** — Works directly in the browser with native ES modules

## Quick Example

```javascript
import { Component, signal, mount, xml } from "@odoo/owl";

class Counter extends Component {
  static template = xml`
    <div class="counter">
      <button t-on-click="this.decrement">-</button>
      <span t-out="this.count()"/>
      <button t-on-click="this.increment">+</button>
    </div>`;

  count = signal(0);

  increment() {
    this.count.set(this.count() + 1);
  }
  decrement() {
    this.count.set(this.count() - 1);
  }
}

mount(Counter, document.body);
```

`count` is a [signal](reference/reactivity.md#signals): calling `this.count()` reads it, and
`this.count.set(...)` updates it. When the value changes, Owl re-renders the
component automatically — no manual subscriptions needed.

## Learn Owl

The fastest way to get started is the **[online playground](../playground/)**,
which features interactive examples, a live editor, and guided tutorials:

- [Getting Started](../playground/#getting_started) — Learn Owl fundamentals step by step
- [Todo List](../playground/#todo_list) — Build a full TodoMVC app
- [Hibou OS](../playground/#hibou_os) — Build a desktop-like interface

## Reference

Browse the [API Reference](reference/overview.md) for a complete list of everything
exported by the Owl library, or jump to a topic:

- [App](reference/app.md) — Configure and mount an Owl application
- [Component](reference/component.md) — Define components with lifecycle methods
- [Reactivity](reference/reactivity.md) — Signals, computed values, and reactive objects
- [Template Syntax](reference/template_syntax.md) — XML templates with QWeb directives
- [Hooks](reference/hooks.md) — Lifecycle hooks and other built-in hooks
- [Plugins](reference/plugins.md) — Share state and services across components

## Installation

```bash
npm install @odoo/owl
```

Or use it directly from a CDN with no build step — see the [App](reference/app.md) page for details.
