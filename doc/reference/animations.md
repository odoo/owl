# 🦉 Animations 🦉

Animation is a complex topic. There are many different use cases, and many
solutions and technologies. Owl only supports some basic use cases.

## Simple CSS effects

Sometimes, using pure CSS is enough. For these use cases, Owl is not really
necessary: it just needs to render a DOM element with a specific class. For
example:

```xml
<a class="btn flash" t-on-click="doSomething">Click</a>
```

with the following CSS:

```css
btn {
  background-color: gray;
}

.flash {
  transition: background 0.5s;
}

.flash:active {
  background-color: #41454a;
  transition: background 0s;
}
```

will produce a nice flash effect whenever the user clicks (or activates with the
keyboard) the button.

## CSS Transitions

A more complex situation occurs when we want to transition an element in or out
of the page. For example, we may want a fade-in and fade-out effect.

The `t-transition` directive is here to help us. It works on html elements and
on components, by adding and removing some css classes.

To perform useful transition effects, whenever an element appears or disappears,
it is necessary to add/remove some css style or class at some precise moment in
the lifetime of a node. Since this is not easy to do by hand, Owl `t-transition`
directive is there to help.

Whenever a node has a `t-transition` directive, with a `name` value, the following
sequence of events will happen:

At node insertion:

- the css classes `name-enter` and `name-enter-active` will be added directly
  when the node is inserted into the DOM,
- on the next animation frame: the css class `name-enter` will be removed and the
  class `name-enter-to` will be added (so they can be used to trigger css
  transition effects),
- the css class `name-enter-active` will be removed whenever a css transition
  ends.

At node destruction:

- the css classes `name-leave` and `name-leave-active` will be added before the
  node is removed to the DOM,
- the css class `name-leave` will be removed on the next animation frame (so it
  can be used to trigger css transition effects),
- the css class `name-leave-active` will be removed whenever a css transition
  ends. Only then will the element be removed from the DOM.

For example, a simple fade in/out effect can be done with this:

```xml
<div>
    <div t-if="state.flag" class="square" t-transition="fade">Hello</div>
</div>
```

```css
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
```

The `t-transition` directive can be applied on a node element or on a component.

Notes:

Owl does not support more than one transition on a single node, so the
`t-transition` expression must be a single value (i.e. no space allowed).
