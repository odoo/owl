# 🦉 Event Handling 🦉

## Content

- [Event Handling](#event-handling)
- [Business DOM Events](#business-dom-events)
- [Inline Event Handlers](#inline-event-handlers)
- [Modifiers](#modifiers)

## Event Handling

In a component's template, it is useful to be able to register handlers on DOM
elements to some specific events. This is what makes a template _alive_. There
are four different use cases.

1. Register an event handler on a DOM node (_pure_ DOM event)
2. Register an event handler on a component (_pure_ DOM event)
3. Register an event handler on a DOM node (_business_ DOM event)
4. Register an event handler on a component (_business_ DOM event)

A _pure_ DOM event is directly triggered by a user interaction (e.g. a `click`).

```xml
<button t-on-click="someMethod">Do something</button>
```

This will be roughly translated in javascript like this:

```js
button.addEventListener("click", component.someMethod.bind(component));
```

The suffix (`click` in this example) is simply the name of the actual DOM
event.

## Business DOM Events

A _business_ DOM event is triggered by a call to `trigger` on a component.

```xml
<MyComponent t-on-menu-loaded="someMethod" />
```

```js
 class MyComponent {
     someWhere() {
         const payload = ...;
         this.trigger('menu-loaded', payload);
     }
 }
```

The call to `trigger` generates an `OwlEvent`, a subclass of [_CustomEvent_](https://developer.mozilla.org/docs/Web/Guide/Events/Creating_and_triggering_events)
with an additional attribute `originalComponent` (the component that triggered
the event). The generated event is of type `menu-loaded` and dispatches it on
the component's DOM element (`this.el`). The event bubbles and is cancelable.
The parent component listening to event `menu-loaded` will receive the payload
in its `someMethod` handler (in the `detail` property of the event), whenever
the event is triggered.

```js
 class ParentComponent {
     someMethod(ev) {
         const payload = ev.detail;
         ...
     }
 }
```

By convention, we use KebabCase for the name of _business_ events.

The `t-on` directive allows to prebind its arguments. For example,

```xml
<button t-on-click="someMethod(expr)">Do something</button>
```

Here, `expr` is a valid Owl expression, so it could be `true` or some variable
from the rendering context.

## Inline Event Handlers

One can also directly specify inline statements. For example,

```xml
<button t-on-click="state.counter++">Increment counter</button>
```

Here, `state` must be defined in the rendering context (typically the component)
as it will be translated to:

```js
button.addEventListener("click", () => {
  context.state.counter++;
});
```

Warning: inline expressions are evaluated in the context of the template. This
means that they can access the component methods and properties. But if they set
a key, the inline statement will actually not modify the component, but a key in
a sub scope.

```xml
<button t-on-click="value = 1">Set value to 1 (does not work!!!)</button>
<button t-on-click="state.value = 1">Set state.value to 1 (work as expected)</button>
```

## Modifiers

In order to remove the DOM event details from the event handlers (like calls to
`event.preventDefault`) and let them focus on data logic, _modifiers_ can be
specified as additional suffixes of the `t-on` directive.

| Modifier   | Description                                                       |
| ---------- | ----------------------------------------------------------------- |
| `.stop`    | calls `event.stopPropagation()` before calling the method         |
| `.prevent` | calls `event.preventDefault()` before calling the method          |
| `.self`    | calls the method only if the `event.target` is the element itself |

```xml
<button t-on-click.stop="someMethod">Do something</button>
```

Note that modifiers can be combined (ex: `t-on-click.stop.prevent`), and that
the order may matter. For instance `t-on-click.prevent.self` will prevent all
clicks while `t-on-click.self.prevent` will only prevent clicks on the element
itself.

Finally, empty handlers are tolerated as they could be defined only to apply
modifiers. For example,

```xml
<button t-on-click.stop="">Do something</button>
```

This will simply stop the propagation of the event.
