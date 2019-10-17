# 🦉 Observer 🦉

Owl needs to be able to react to state changes. For example, whenever the state
of a component is changed, we need to rerender it. To help with that, we have
an Observer class. Its job is to observe some object state, and react to any
change. To do that, it recursively replaces all keys of the observed state by
getters and setters.

For example, this code will display `update` in the console:

```javascript
const observer = new owl.Observer();
observer.notifyCB = () => console.log("update");
const obj = observer.observe({ a: { b: 1 } });

obj.a.b = 2;
```

The observer is implemented with the native `Proxy` object. Note that this
means that it will not work on older browsers.
