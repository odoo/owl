<h1 align="center">🦉 <a href="https://odoo.github.io/owl/">Owl</a> 🦉</h1>

<p align="center">
  <strong>A modern, lightweight UI framework for applications that scale</strong>
</p>

[![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)
[![npm version](https://badge.fury.io/js/@odoo%2Fowl.svg)](https://badge.fury.io/js/@odoo%2Fowl)
[![Downloads](https://img.shields.io/npm/dm/@odoo%2Fowl.svg)](https://www.npmjs.com/package/@odoo/owl)

---

> **Owl 3.0.0 Alpha:** This is an alpha release. The API and features are subject to change without notice.

---

## Try it now

The fastest way to discover Owl is the **[online playground](https://odoo.github.io/owl/playground)**.
It features interactive examples, a live editor, and showcases all major features:
reactivity, components, plugins, and more. It also includes **guided tutorials**
and is the recommended way to learn about Owl.

## What is Owl?

Owl is a modern UI framework (~20kb gzipped, zero dependencies) written in TypeScript,
built by [Odoo](https://www.odoo.com/). It powers Odoo's web client, one of the largest
open-source business applications, but is equally suited for small projects and prototypes.

Key features:

- **Signal-based reactivity** — Explicit, composable, and debuggable state management
- **Plugin system** — Type-safe, composable sharing of state and services
- **Class-based components** — Familiar OOP patterns with ES6 classes
- **Declarative templates** — XML templates with a clean syntax
- **Async rendering** — Concurrent mode for smooth user experiences

## Quick Example

```javascript
import { Component, signal, computed, mount, xml } from "@odoo/owl";

class TodoList extends Component {
  static template = xml`
    <input placeholder="Add todo..." t-on-keydown="this.onKeydown"/>
    <ul>
      <t t-foreach="this.todos()" t-as="todo" t-key="todo.id">
        <li t-att-class="{ done: todo.done }">
          <input type="checkbox" t-model="todo.done"/>
          <t t-out="todo.text"/>
        </li>
      </t>
    </ul>
    <p t-if="this.remaining() > 0">
      <t t-out="this.remaining()"/> item(s) remaining
    </p>`;

  todos = signal.Array([
    { id: 1, text: "Learn Owl", done: false },
    { id: 2, text: "Build something", done: false },
  ]);

  remaining = computed(() => this.todos().filter((t) => !t.done).length);

  onKeydown(ev) {
    if (ev.key === "Enter" && ev.target.value) {
      this.todos.push({
        id: Date.now(),
        text: ev.target.value,
        done: false,
      });
      ev.target.value = "";
    }
  }
}

mount(TodoList, document.body);
```

This example demonstrates Owl's reactivity: `todos` is a signal, `remaining`
is a computed value that updates automatically, and the UI reacts to changes
without manual subscription management.

## Design Principles

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

## Resources

### Getting Started

- **[Playground](https://odoo.github.io/owl/playground)** — Interactive examples and live coding
- **[Owl 3.x Release Notes](release_notes.md)** — Complete guide to all changes
- [Tutorial: Getting Started](https://odoo.github.io/owl/playground#getting_started) — Learn Owl fundamentals step by step
- [Tutorial: Todo List](https://odoo.github.io/owl/playground#todo_list) — Build a full TodoMVC app
- [Tutorial: Hibou OS](https://odoo.github.io/owl/playground#hibou_os) — Build a desktop-like interface

### Reference Documentation

- [Overview](doc/readme.md)
- [App](doc/reference/app.md) | [Component](doc/reference/component.md)
- [Reactivity](doc/reference/reactivity.md) | [Hooks](doc/reference/hooks.md)
- [Templates](doc/reference/templates.md) | [Props](doc/reference/props.md)
- [Slots](doc/reference/slots.md)

### Understanding Owl

- [Why we built Owl](doc/miscellaneous/why_owl.md)
- [Architecture Notes](doc/miscellaneous/architecture.md)
- [Comparison with React/Vue](doc/miscellaneous/comparison.md)

## Installation

```bash
npm install @odoo/owl
```

Or download directly: [latest release](https://github.com/odoo/owl/releases/latest)

## Devtools

The Owl devtools extension helps debug your applications with component tree
inspection, state visualization, and performance profiling. Download it from
the [releases page](https://github.com/odoo/owl/releases/latest).

## License

Owl is released under the [LGPL v3](https://www.gnu.org/licenses/lgpl-3.0) license.
