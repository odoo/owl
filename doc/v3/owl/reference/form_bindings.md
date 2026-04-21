# Form Bindings

It is very common to need to be able to read the value out of an html `input` (or
`textarea`, or `select`) in order to use it (note: it does not need to be in a
form!). A possible way to do this is to do it by hand:

```js
class Form extends Component {
  static template = xml`
    <div>
      <input t-on-input="onInput" />
      <span t-out="this.text()"/>
    </div>`;

  text = signal("");

  onInput(event) {
    this.text.set(event.target.value);
  }
}
```

This works. However, this requires a little bit of _plumbing_ code. Also, the
plumbing code is slightly different if you need to interact with a checkbox,
or with radio buttons, or with select tags.

To help with this situation, Owl has a builtin directive `t-model`: its value
should be a signal (or a computed value). With the `t-model` directive, we can
write a shorter code, equivalent to the previous example:

```js
class Form extends Component {
  static template = xml`
    <div>
      <input t-model="this.text"/>
      <span t-out="this.text()"/>
    </div>`;

  text = signal("");
}
```

The `t-model` directive works with `<input>`, `<input type="checkbox">`,
`<input type="radio">`, `<textarea>` and `<select>`:

```xml
<div>
    <div>Text in an input: <input t-model="this.someVal"/></div>
    <div>Textarea: <textarea t-model="this.otherVal"/></div>
    <div>Boolean value: <input type="checkbox" t-model="this.someFlag"/></div>
    <div>Selection:
        <select t-model="this.color">
            <option value="">Select a color</option>
            <option value="red">Red</option>
            <option value="blue">Blue</option>
        </select>
    </div>
    <div>
        Selection with radio buttons:
        <span>
            <input type="radio" name="color" id="red" value="red" t-model="this.color"/>
            <label for="red">Red</label>
        </span>
        <span>
            <input type="radio" name="color" id="blue" value="blue" t-model="this.color" />
            <label for="blue">Blue</label>
        </span>
    </div>
</div>
```

## Modifiers

Like event handling, the `t-model` directive accepts the following modifiers:

| Modifier  | Description                                                          |
| --------- | -------------------------------------------------------------------- |
| `.lazy`   | update the value on the `change` event (default is on `input` event) |
| `.number` | try to parse the value to a number (using `parseFloat`)              |
| `.trim`   | trim the resulting value                                             |

For example:

```xml
<input t-model.lazy="this.someVal" />
```

These modifiers can be combined. For instance, `t-model.lazy.number` will only
update a number whenever the change is done.

## Using t-model with proxy objects

By default, `t-model` expects a signal. If you are using a reactive `proxy`
object instead, you can use the `.proxy` modifier. Its value should be a
dot-notation path to the property:

```js
class Form extends Component {
  static template = xml`
    <div>
      <input t-model.proxy="this.state.text"/>
      <span t-out="this.state.text"/>
    </div>`;

  state = proxy({ text: "" });
}
```

The `.proxy` modifier can be combined with other modifiers:

```xml
<input t-model.proxy.trim="this.state.name"/>
<input t-model.proxy.number="this.state.count"/>
<input t-model.proxy.lazy="this.state.text"/>
```

Note: the online playground has an example to show how it works.
