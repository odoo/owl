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
