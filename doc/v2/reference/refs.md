# 🦉 References 🦉

The `useRef` hook is useful when we need a way to interact with some inside part
of a component, rendered by Owl. It can work either on a DOM node, or on a component,
targeted by the `t-ref` directive. See the [hooks section](hooks.md#useref) for
more detail.

As a short example, here is how we could set the focus on a given input:

```xml
<div>
    <input t-ref="input"/>
    <button t-on-click="focusInput">Click</button>
</div>
```

```js
import { useRef } from "owl/hooks";

class SomeComponent extends Component {
  inputRef = useRef("input");

  focusInput() {
    this.inputRef.el.focus();
  }
}
```

Be aware that the `el` property will only be set when the target of the `t-ref`
directive is mounted in the DOM. Otherwise, it will be set to `null`.

The `useRef` hook cannot be used to get a reference to an instance of a sub
component.

Note that this example uses the suffix `ref` to name the reference. This
is not mandatory, but it is a useful convention, so we do not forget that it is
a reference object.
