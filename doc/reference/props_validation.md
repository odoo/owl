# 🦉 Props Validation 🦉

As an application becomes complex, it may be quite unsafe to define props in an informal way. This leads to two issues:

- hard to tell how a component should be used, by looking at its code.
- unsafe, it is easy to send wrong props into a component, either by refactoring a component, or one of its parents.

A props type system solves both issues, by describing the types and shapes
of the props. Here is how it works in Owl:

- `props` key is a static key (so, different from `this.props` in a component instance)
- it is optional: it is ok for a component to not define a `props` key.
- props are validated whenever a component is created/updated
- props are only validated in `dev` mode (see [config page](config.md#mode))
- if a key does not match the description, an error is thrown
- it validates keys defined in (static) `props`. Additional keys given by the
  parent will cause an error.

For example:

```js
class ComponentA extends owl.Component {
    static props = ['id', 'url'];

    ...
}

class ComponentB extends owl.Component {
  static props = {
    count: {type: Number},
    messages: {
      type: Array,
      element: {type: Object, shape: {id: Boolean, text: 'string' }
    },
   date: Date,
   combinedVal: [Number, Boolean]
  };

  ...
}
```

- it is an object or a list of strings
- a list of strings is a simplified props definition, which only lists the name
  of the props. Also, if the name ends with `?`, it is considered optional.
- all props are by default required, unless they are defined with `optional: true`
  (in that case, validation is only done if there is a value)
- valid types are: `Number, String, Boolean, Object, Array, Date, Function`, and all
  constructor functions (so, if you have a `Person` class, it can be used as a type)
- arrays are homogeneous (all elements have the same type/shape)

For each key, a `prop` definition is either a boolean, a constructor, a list of constructors, or an object:

- a boolean: indicate that the props exists, and is mandatory.
- a constructor: this should describe the type, for example: `id: Number` describe
  the props `id` as a number
- a list of constructors. In that case, this means that we allow more than one
  type. For example, `id: [Number, String]` means that `id` can be either a string
  or a number.
- an object. This makes it possible to have more expressive definition. The following sub keys are then allowed (but not mandatory):
  - `type`: the main type of the prop being validated
  - `element`: if the type was `Array`, then the `element` key describes the type of each element in the array. If it is not set, then we only validate the array, not its elements,
  - `shape`: if the type was `Object`, then the `shape` key describes the interface of the object. If it is not set, then we only validate the object, not its elements,
  - `validate`: this is a function which should return a boolean to determine if
    the value is valid or not. Useful for custom validation logic.

Examples:

```js
  // only the existence of those 3 keys is documented
  static props = ['message', 'id', 'date'];
```

```js
  // size is optional
  static props = ['message', 'size?'];
```

```js
  static props = {
    messageIds: {type: Array, element: Number},  // list of number
    otherArr: {type: Array},   // just array. no validation is made on sub elements
    otherArr2: Array,   // same as otherArr
    someObj: {type: Object},  // just an object, no internal validation
    someObj2: {
      type: Object,
      shape: {
        id: Number,
        name: {type: String, optional: true},
        url: String
      ]},    // object, with keys id (number), name (string, optional) and url (string)
    someFlag: Boolean,     // a boolean, mandatory (even if `false`)
    someVal: [Boolean, Date],   // either a boolean or a date
    otherValue: true,     // indicates that it is a prop
    kindofsmallnumber: {
      type: Number,
      validate: n => (0 <= n && n <= 10)
    },
    size: {
      validate:  e => ["small", "medium", "large"].includes(e)
    },
  };
```
