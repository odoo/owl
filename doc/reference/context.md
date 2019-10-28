# 🦉 Context 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)
  - [`Context`](#context)
  - [`useContext`](#usecontext)

## Overview

The `Context` object provides a way to share data between an arbitrary number
of components. Usually, data is passed from a parent to its children component,
but when we have to deal with some mostly global information, this can be
annoying, since each component will need to pass the information to each children,
even though some or most of them will not use the information.

With a `Context` object, each component can subscribe (with the `useContext` hook)
to its state, and will be updated whenever the context state is updated.

## Example

Assume that we have an application with various components which needs to render
differently depending on the size of the device. Here is how we could proceed
to make sure that the information is properly shared. First, let us create a
context, and add it to the environment:

```js
const deviceContext = new Context({ isMobile: true });
const env = {
  qweb: new QWeb({ templates: TEMPLATES }),
  deviceContext
};
```

If we want to make it completely responsive, we need to update its value whenever
the size of the screen is updated:

```js
const isMobile = () => window.innerWidth <= 768;
window.addEventListener(
  "resize",
  owl.utils.debounce(() => {
    const state = deviceContext.state;
    if (state.isMobile !== isMobile()) {
      state.isMobile = !state.isMobile;
    }
  }, 15)
);
```

Then, each component that want can subscribe and render differently depending on the
fact that we are in a mobile or desktop mode.

```js
class SomeComponent extends Component {
  static template = xml`
        <div>
          <t t-if=device.isMobile>
             some simplified user interface
          </t>
          <t t-else="1">
             some more sopthisticated user interface
          </t>
    `;
  device = useContext(this.env.deviceContext);
}
```

## Reference

### `Context`

A `Context` object should be created with a state object:

```js
const someContext = new Context({ some: "key" });
```

Its state is now available in the `state` key:

```js
someContext.state.some = "other key";
```

This is the way some global code (such as the responsive code above) should
read and update the context state. However, components should not ever read the
context state directly from the context, they should instead use the `useContext`
hook to properly register themselves to state changes.

Note that the `Context` hook is different from the React version. For example,
there is no concept of provider/consumer. So, the `Context` feature does not
by itself allow the use of a different context state depending on the component
place in the component tree. However, this functionality can be obtained, if
necessary, with the use of sub environment.

### `useContext`

The `useContext` hook is the normal way for a component to register themselve
to context state changes. The `useContext` method returns the context state:

```js
device = useContext(this.env.deviceContext);
```

It is a simple observed state (with an owl `Observer`), which contains the shared
information.
