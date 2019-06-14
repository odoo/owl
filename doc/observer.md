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
changes in three situations:

- adding a key to an object
- deleting a key from an object
- modifying an array by setting a new value at a given index

In those situations, we need a way to tell the observer that something happened.
This can be done by using the `set` and `delete` (only for objects) static
methods of the `Observer`.

```javascript
const observer = new owl.Observer();
const obj = { a: 1 };
observer.observe(obj);
obj.b = 2; // won't notify the change
owl.Observer.set(obj, "b", 2); // will notify the change

delete obj.b; // won't notify the change
owl.Observer.delete(obj, "b"); // will notify the change
```

```javascript
const observer = new owl.Observer();
const arr = ["a"];
observer.observe(arr);
arr[0] = "b"; // won't notify the change
owl.Observer.set(arr, 0, "b"); // will notify the change
```
