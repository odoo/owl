# 🦉 Event Bus 🦉

It is sometimes useful to use a `Bus` to communicate informations between various
parts of the code. Owl has a very simple bus class, which manages subscriptions,
triggering events, and callbacks.

```js
const bus = new owl.core.EventBus();

bus.on("some-event", null, function (...args) {
  console.log(...args);
});

bus.trigger("some-event", 1, 2, 3);
// [1,2,3] will be logged to the console
```

Its API is:

| Method                           | Description                       |
| -------------------------------- | --------------------------------- |
| `on(eventType, owner, callback)` | add a listener                    |
| `off(eventType, owner)`          | remove all listeners for an owner |
| `trigger(eventType, ...args)`    | trigger an event                  |
| `clear`                          | remove all subscriptions          |

Note that the [`Store`](store.md) is an example of an `EventBus`.
