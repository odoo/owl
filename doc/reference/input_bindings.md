# 🦉 Form Input Bindings 🦉

It is very common to need to be able to read the value out of an html `input` (or
`textarea`, or `select`) in order to use it (note: it does not need to be in a
form!). A possible way to do this is to do it by hand:

```js
class Form extends owl.Component {
  state = useState({ text: "" });

  _updateInputValue(event) {
    this.state.text = event.target.value;
  }
}
```

```xml
<div>
  <input t-on-input="_updateInputValue" />
  <span t-esc="state.text" />
</div>
```

This works. However, this requires a little bit of _plumbing_ code. Also, the
plumbing code is slightly different if you need to interact with a checkbox,
or with radio buttons, or with select tags.

To help with this situation, Owl has a builtin directive `t-model`: its value
should be an observed value in the component (usually `state.someValue`). With
the `t-model` directive, we can write a shorter code, equivalent to the previous
example:

```js
class Form extends owl.Component {
  state = useState({ text: "" });
}
```

```xml
<div>
  <input t-model="state.text" />
  <span t-esc="state.text" />
</div>
```

The `t-model` directive works with `<input>`, `<input type="checkbox">`,
`<input type="radio">`, `<textarea>` and `<select>`:

```xml
<div>
    <div>Text in an input: <input t-model="state.someVal"/></div>
    <div>Textarea: <textarea t-model="state.otherVal"/></div>
    <div>Boolean value: <input type="checkbox" t-model="state.someFlag"/></div>
    <div>Selection:
        <select t-model="state.color">
            <option value="">Select a color</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
        </select>
    </div>
    <div>
        Selection with radio buttons:
        <span>
            <input type="radio" name="color" id="red" value="red" t-model="state.color"/>
            <label for="red">Red</label>
        </span>
        <span>
            <input type="radio" name="color" id="blue" value="blue" t-model="state.color" />
            <label for="blue">Blue</label>
        </span>
    </div>
</div>
```

Like event handling, the `t-model` directive accepts the following modifiers:

| Modifier  | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| `.lazy`   | update the value on the `change` event (default is on `input` event) |
| `.number` | try to parse the value to a number (using `parseFloat`)              |
| `.trim`   | trim the resulting value                                             |

For example:

```xml
<input t-model.lazy="state.someVal" />
```

These modifiers can be combined. For instance, `t-model.lazy.number` will only
update a number whenever the change is done.

Note: the online playground has an example to show how it works.
