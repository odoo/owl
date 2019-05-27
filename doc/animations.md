# 🦉 Animations 🦉


Animation is a complex topic. There are many different use cases, and many
solutions and technologies.

## Simple CSS effects

Sometimes, using pure CSS is enough.  For these use cases, Owl is not really
necessary: it just needs to render a DOM element with a specific class. For
example:


```xml
<button class="flash" t-on-click="doSomething">Click</button>
```

with the following CSS:

```css
.flash {
  transition: background 0.5s;
}

.flash:active {
  background-color: #41454a;
  transition: background 0s;
}
```

will produce a nice flash effect whenever the user click (or activate with the
keyboard) the button.

## CSS Transitions (single element)

A more complex situation occurs when we want to transition an element in or out
of the page.  For example, we may want a fade-in and fade-out effect.

The `t-transition` directive is here to help us (see [QWeb documentation](qweb.md#t-transition-directive)).
