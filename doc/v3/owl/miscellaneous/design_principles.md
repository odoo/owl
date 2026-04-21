# Design Principles

Owl is built on principles that make it powerful yet approachable:

**Explicit over Implicit**

Reactiveness is explicit — you read signals by calling them (`this.count()`),
making dependencies visible and bugs easier to trace. No hidden magic.

**Composable Architecture**

Plugins provide a structured way to share state and services across components.
They compose naturally and support full type inference.

**Scales with You**

Start simple with inline templates and signals. Grow into a large codebase
with external templates, registries, and plugins. Owl powers Odoo's
multi-million-line codebase — it's proven at scale.

**Developer Experience**

First-class TypeScript support, comprehensive error messages in dev mode,
and a browser devtools extension for debugging.
