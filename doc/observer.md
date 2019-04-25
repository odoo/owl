# 🦉 Observer 🦉

Owl need to be able to react to state changes. For example, whenever the state
of a component is changed, we need to rerender it. To help with that, we have
an Observer class. Its job is to observe some object state, and react to any
change. To do that, it recursively replace all keys of the observed state by
getters and setters.

For example, this code will display `update` in the console:

```javascript
const observer = new owl.Observer();
observer.notifyCB = () => console.log("update");
observer.observe(obj);

const obj = { a: { b: 1 } };
obj.a.b = 2;
```

## Technical Limitations

Since the observer uses getters and setters, it is actually unable to react to
changes in two situations:

- adding a key to an object:

  ```javascript
  const observer = new owl.Observer();
  const obj = { a: 1 };
  observer.observe(obj);
  obj.b = 2; // will do nothing
  ```

  In that case, we need a way to tell the observer that something happened.
  This can be done by using the `set` method:

  ```javascript
  observer.set(obj, "b", 2);
  ```

- modifying an array by setting a new value at a given index:

  ```javascript
  const observer = new owl.Observer();
  const obj = { todos: [{ id: 1, text: "todo" }] };
  observer.observe(obj);
  obj[0] = { id: 2, text: "othertodo" }; // will do nothing, and obj[0] is not observed
  ```

  In that case, the solution is the same, we can simply use the `set` method:

  ```javascript
  observer.set(obj, 0, { id: 2, text: "othertodo" });
  ```
