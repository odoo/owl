# 🦉 Observer 🦉

Owl needs to be able to react to state changes. For example, whenever the state
of a component is changed, Owl needs to rerender it. To help with that, there is
an Observer class. Its job is to observe the state of an object (or array), and
to react to any change. The observer is implemented with the native `Proxy`
object. Note that this means that it will not work on older browsers.

Note that the `Observer` is used by the `useState` and `useContext` hooks. This
is the way most Owl applications will create observers. For the majority of
use cases, there is no need to directly instantiate an observer.

## Example

For example, this code will display `update` in the console:

```javascript
const observer = new owl.core.Observer();
observer.notifyCB = () => console.log("update");
const obj = observer.observe({ a: { b: 1 } });

obj.a.b = 2;
```

This example shows that an observer can observe nested properties.

## Reference

**observe** An observer can observe multiple values with the `observe` method.
This method takes an object or an array as its argument and will return a proxy
(which is mapped to the initial object/array). With this proxy, the observer
can detect whenever any internal value is changed.

**Registering a callback** Whenever an observer sees a state change, it will
call its `notifyCB` method. No additional information is given to the callback.

**deepRevNumber** Each observed value has an internal revision number, which
is incremented every time the value is observed. Sometimes, it can be useful
to obtain that number:

```js
const observer = new owl.core.Observer();
const obj = observer.observe({ a: { b: 1 } });

observer.revNumber(obj.a); // 1
obj.a.b = 2;

observer.revNumber(obj.a); // 2
```

The `revNumber` can also return 0, which indicates that the value is not
observed.
