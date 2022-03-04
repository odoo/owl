# 🦉 Event Handling 🦉

## Content

- [Event Handling](#event-handling)
- [Modifiers](#modifiers)
- [Synthetic Events](#synthetic-events)
- [On Components](#on-components)

## Event Handling

In a component's template, it is useful to be able to register handlers on DOM
elements to some specific events. This is what makes a template _alive_. This
is done with the `t-on` directive. For example:

```xml
<button t-on-click="someMethod">Do something</button>
```

This will be roughly translated in javascript like this:

```js
button.addEventListener("click", component.someMethod.bind(component));
```

The suffix (`click` in this example) is simply the name of the actual DOM
event. The value of the `t-on` expression should be a valid javascript expression
that evaluates to a function in the context of the current component. So, one
can get a reference to the event, or pass some additional arguments. For example,
all the following expressions are valid:

```xml
<button t-on-click="someMethod">Do something</button>
<button t-on-click="() => this.increment(3)">Add 3</button>
<button t-on-click="ev => this.doStuff(ev, 'value')">Do something</button>
```

Notice the use of the `this` keyword in the lambda function: this is the
correct way to call a method on the component in a lambda function.

One could use the following expression:

```xml
<button t-on-click="() => increment(3)">Add 3</button>
```

But then, the increment function may be unbound (unless the component binds it
in its setup function, for example).

## Modifiers

In order to remove the DOM event details from the event handlers (like calls to
`event.preventDefault`) and let them focus on data logic, _modifiers_ can be
specified as additional suffixes of the `t-on` directive.

| Modifier     | Description                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `.stop`      | calls `event.stopPropagation()` before calling the method                                                                |
| `.prevent`   | calls `event.preventDefault()` before calling the method                                                                 |
| `.self`      | calls the method only if the `event.target` is the element itself                                                        |
| `.capture`   | bind the event handler in [capture](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) mode. |
| `.synthetic` | define a synthetic event handler (see below)                                                                             |

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

## Synthetic Events

In some cases, attaching an event handler for each element of large lists has
a non trivial cost. Owl provides a way to efficiently improve the performance:
with synthetic event, it actually adds only one handler on the document body,
and will properly call the handler, just as expected.

The only difference with regular events is that the event is caught at the document
body, so it cannot be stopped before it actually gets there. Since it may be
surprising in some cases, it is not enabled by default.

To enable it, one can just use the `.synthetic` suffix:

```xml
<div>
    <t t-foreach="largeList" t-as="elem" t-key="elem.id">
        <button t-on-click.synthetic="doSomething" ...>
            <!-- some content -->
        </button>
    </t>
</div>
```

## On Components

The `t-on` directive also works on a child component:

```xml
<div>
    in some template
    <Child t-on-click="dosomething"/>
</div>
```

This will catch all click events on any html element contained in the `Child`
sub component. Note that if the child component is reduced to one (or more) text
nodes, then clicking on it will not call the handler, since the event will be
dispatched by the browser on the parent element (a `div` in this case).
