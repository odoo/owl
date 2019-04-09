# Component

Components are the reusable, composable widgets. They are designed to be low
level, to be declarative, and with asynchronous rendering.

For example:

```javascript
export class Counter extends Component {
  template = "counter";
  state = { counter: 0 };

  constructor(parent, props) {
    super(parent, props);
    this.state.counter = props.initialState || 0;
  }

  increment(delta) {
    this.updateState({ counter: this.state.counter + delta });
  }
}
```

```xml
    <div t-name="counter">
      <button t-on-click="increment(-1)">-</button>
      <span style="font-weight:bold">Value: <t t-esc="state.counter"/></span>
      <button t-on-click="increment(1)">+</button>
    </div>`;
```

## Lifecycle

A solid and robust component system needs useful hooks/methods to help
developers write components. Here is a description of the lifecycle of a owl
component:

- **[constructor](#constructor)**
- **[willStart](#willStart)**
- **[mounted](#mounted)**
- **[willPatch](#willPatch)**
- **[updated](#updated)**
- **[willUnmount](#willUnmount)**
- **[destroyed](#destroyed)**

Note: no hook method should ever be called manually. They are supposed to be
called by the owl framework whenever it is required.

### constructor

The constructor is not exactly a hook, it is the constructor of the component.

### willStart

willStart is an asynchronous hook that can be implemented to perform some
action before the initial rendering of a component.

It will be called exactly once before the initial rendering. It is useful
in some cases, for example, to load external assets (such as a JS library)
before the widget is rendered. Another use case is to load data from a server.

Note that a slow willStart method will slow down the rendering of the user
interface. Therefore, some effort should be made to make this method as
fast as possible.

### mounted

mounted is a hook that is called each time a component is attached to the
DOM. This is a good place to add some listeners, or to interact with the
DOM, if the component needs to perform some measure for example.

It is the opposite of _willUnmount_. If a component has been mounted, it will
be unmounted at some point.

### willUpdateProps

The willUpdateProps is an asynchronous hook, called just before new props
are set. This is useful if the component needs some asynchronous task
performed, depending on the props (for example, assuming that the props are
some record Id, fetching the record data).

This hook is not called during the first render (but willStart is called
and performs a similar job).

### willPatch

The willPatch hook is called just before the DOM patching process starts.
It is not called on the initial render. This is useful to get some
information which are in the DOM. For example, the current position of the
scrollbar

Note that at this point, it is not safe to rerender the widget. In
particular, updateState calls should be avoided.

### patched

This hook is called whenever a component did actually update its props,
state or env.

This method is not called on the initial render. It is useful to interact
with the DOM (for example, through an external library) whenever the
component was patched.

Updating the widget state in this hook is possible, but not encouraged.
One need to be careful, because updates here will cause rerender, which in
turn will cause other calls to patched. So, we need to be particularly
careful at avoiding endless cycles.

### willUnmount

willUnmount is a hook that is called each time just before a component is unmounted from
the DOM. This is a good place to remove some listeners, for example.

This is the opposite method of _mounted_. The _willUnmount_ method will be
called in reverse order: first the children, then the parents.
