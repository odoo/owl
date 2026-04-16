# References

References provide a way to interact with DOM elements rendered by a component.
In Owl 3, references are signal-based: you create a `signal(null)` and bind it
to a DOM node using the `t-ref` directive. The signal's value is the HTMLElement
when mounted, or `null` otherwise.

As a short example, here is how we could set the focus on a given input:

```xml
<div>
    <input t-ref="this.inputRef"/>
    <button t-on-click="this.focusInput">Click</button>
</div>
```

```js
class SomeComponent extends Component {
  inputRef = signal(null);

  focusInput() {
    this.inputRef()?.focus();
  }
}
```

The signal value will only be set when the target of the `t-ref`
directive is mounted in the DOM. Otherwise, it will be `null`.

Note that this example uses the suffix `Ref` to name the reference. This
is not mandatory, but it is a useful convention, so we do not forget that it is
a reference signal.

## Multiple References with Resources

When `t-ref` is used inside a loop, a single signal can only hold one element.
For this case, `t-ref` also accepts a [Resource](resources_and_registries.md#resource):
it will automatically add elements to the resource when they are mounted and
remove them when they are unmounted.

```xml
<t t-foreach="this.items()" t-as="item" t-key="item">
  <p t-ref="this.paragraphs" t-att-id="item"/>
</t>
```

```js
class MyComponent extends Component {
  items = signal([1, 2, 3]);
  paragraphs = new Resource({ name: "paragraphs" });

  get allParagraphs() {
    return this.paragraphs.items(); // reactive list of <p> elements
  }
}
```

The resource's `items()` is reactive: it updates automatically when elements
are added or removed (e.g. when the list changes). This is useful for
interacting with multiple DOM elements, such as measuring their dimensions or
attaching external libraries.

## Combining with useListener

See the [hooks section](hooks.md#uselistener) for how to combine references
with `useListener` to listen to events on referenced elements.
