## Getting Started with Owl

Welcome to the **Getting Started** tutorial! Over a series of short steps, you
will learn the fundamentals of Owl — signals, components, hooks, and more — by
building small, focused exercises. Each step introduces one concept and builds
on what you learned before.

Use the navigation bar above the editor to move between steps. Each step
includes hints and a solution you can reveal if you get stuck. You can also
refer to the [Owl documentation](https://github.com/odoo/owl/tree/master#documentation)
at any time. Let's begin!

---

## Step 1: A Simple Counter

Your first task is to build a counter component: it should display a numeric
value with buttons to increment and decrement it. Open `main.js` — you will
see a minimal `Counter` component. Your goal is to make it interactive.

Here is what you need to do:

- Add a **signal** to track the counter value
- Add **increment** and **decrement** methods
- Update the **template** to display the value and wire up the buttons

### Hints

A **signal** is a reactive container for a value. You create one with `signal(initialValue)`,
read it by calling it as a function (`signal()`), and update it with `.set(newValue)`.
Whenever a signal's value changes, Owl automatically re-renders every component
that read that signal during its last render — you never have to manually
trigger an update. See the [Signals](https://github.com/odoo/owl/blob/master/doc/reference/reactivity.md#signals)
section for more details.

Import `signal` from `@odoo/owl` and create one as a class property:

```js
count = signal(0);
```

To read the value, call the signal: `this.count()`. To update it, use `.set(...)`:

```js
this.count.set(this.count() + 1);
```

In the template, you can read component values with `this` and handle DOM
events with the `t-on-` directive. For example:

```xml
<t t-out="this.count()"/>
<button t-on-click="this.increment">+</button>
```

## Bonus exercise

Add a "Reset" button that sets the count back to 0.

## Notes

The template of the component is defined inline in this example, using the
`xml` function, but in real code, it should be defined in an xml file. This is
due to the fact that in Odoo, only templates defined in xml files can be targeted
by xpaths and can be translated.

