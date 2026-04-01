## Toggle Todo Completion

You may have noticed that clicking the checkbox next to a todo does not
update the strikethrough styling. This is because the `completed` field is a
plain boolean — Owl does not track changes to it. In this step, you will make
it reactive by turning it into a signal.

Here is what you need to do:

- Change the `completed` field in each todo object from `false`/`true` to
  `signal(false)`/`signal(true)`
- Update the `TodoItem` template to read `this.props.todo.completed()` instead
  of `this.props.todo.completed`
- Update the `t-att-class` to use the signal value:
  `{ completed: this.props.todo.completed() }`
- Use `t-model="this.props.todo.completed"` on the checkbox to bind it
  directly to the signal
- Update the props definition in `TodoItem` to validate `completed` as
  `t.signal()` instead of `t.boolean`
- Click on the checkboxes to verify that the strikethrough styling now updates
  correctly

### Hints

A signal wraps a value and makes it reactive. Changing `completed: false` to
`completed: signal(false)` means Owl will track reads and updates:

```js
{ id: 1, text: "Buy milk", completed: signal(false) }
```

In the template, read it by calling it:

```xml
<span t-att-class="{ completed: this.props.todo.completed() }">
```

The `t-model` directive works with signals — it reads and writes the value
automatically:

```xml
<input type="checkbox" t-model="this.props.todo.completed"/>
```

To validate a signal prop, use `t.signal()`:

```js
props = props({
    todo: t.object({ id: t.number, text: t.string, completed: t.signal() }),
});
```

## Bonus Exercises

- Make clicking anywhere on a todo item (not just the checkbox) toggle the
  completed state.
