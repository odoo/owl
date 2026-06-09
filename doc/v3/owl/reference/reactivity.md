# Reactivity

## Introduction

Reactivity is the mechanism by which the framework automatically updates the
interface in response to state changes. Owl 3 provides a fine-grained reactivity
system built on four primitives: **signals**, **computed values**, **proxies**,
and **effects**.

A key design principle is that reactive values are **not tied to components**.
They can be created anywhere — in a component, a plugin, or a plain JavaScript
module — and shared freely across the application. Dependency tracking happens
at read time: when a reactive value is read inside an effect or a component
render, a subscription is created. When the value changes, all subscribers are
notified and updates are batched via microtasks.

```js
const count = signal(0);
const state = proxy({ color: "red", value: 15 });
const total = computed(() => count() + state.value);

console.log(total()); // 15
```

## The primitives

Each primitive has its own reference page:

- **[Signals](signals.md)** — the basic reactive container: a value you read
  and write explicitly (`s()` / `s.set(v)`). Collection and ref variants are
  covered there too.
- **[Computed values](computed_values.md)** — lazily-evaluated derived values
  that track their dependencies and recompute on demand, plus the asynchronous
  `asyncComputed`.
- **[Proxies](proxies.md)** — reactive objects where reading a property
  subscribes to it and writing notifies subscribers, with deep wrapping.
- **[Effects](effects.md)** — functions that re-run when their reactive
  dependencies change, including the `useEffect` component hook.

## How they tie together

The four primitives share a single dependency-tracking mechanism. Whenever a
reactive value — a [signal](signals.md), a [computed](computed_values.md), or a
[proxy](proxies.md) property — is **read** inside a tracking context (an
[effect](effects.md), a [computed](computed_values.md), or a component render), a
subscription is recorded. When that value later changes, every subscriber is
invalidated and rescheduled.

This is why the primitives compose freely: a `computed` can read signals and
proxy properties; an `effect` can read computeds; a component template is itself
a tracking context that re-renders when any reactive value it read changes. None
of them need to know about each other — they only need to be read and written
through the reactive APIs.

```js
const first = signal("John");
const last = signal("Doe");
const fullName = computed(() => `${first()} ${last()}`);

effect(() => console.log(fullName())); // logs "John Doe"
first.set("Jane"); // after a microtask, the effect logs "Jane Doe"
```

## Batching

All reactive updates are batched in microtasks. Multiple signal writes in the
same synchronous block trigger only a single effect re-run:

```js
const a = signal(1);
const b = signal(2);

effect(() => {
  console.log(a() + b()); // logs 3
});

a.set(10);
b.set(20);
// only one re-run after the microtask — logs 30, not 12 then 30
```
