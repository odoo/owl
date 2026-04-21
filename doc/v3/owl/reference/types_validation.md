# Types Validation

## Overview

Owl provides a type validation system built around the `types` object, which
contains composable validators for common JavaScript types.

The main use case is **props validation**: when developing components in dev
mode, Owl uses these validators to check that props received by a component
match their declared types. This catches bugs early by reporting mismatches
at render time rather than letting them propagate silently.

```js
import { Component, xml, types as t, props } from "@odoo/owl";

class UserCard extends Component {
  static template = xml`
    <div>
      <span t-out="this.props.name"/>
      <span t-if="this.props.age" t-out="this.props.age"/>
    </div>`;

  props = props({
    name: t.string(),
    "age?": t.number(),
  });
}
```

The validators can also be used standalone via `validateType` and `assertType`
to validate any value at runtime, not just props.

## `validateType`

Checks a value against a validator and returns a list of validation issues.
An empty list means the value is valid.

```js
import { types as t, validateType } from "@odoo/owl";

validateType(42, t.number()); // [] (valid)
validateType("hello", t.number()); // [{ message: "value is not a number" }]

validateType([1, 2, 3], t.array(t.number())); // [] (valid)
validateType([1, "two"], t.array(t.number())); // [{ message: "value is not a number" }]

const userType = t.object({
  name: t.string(),
  "age?": t.number(),
});

validateType({ name: "Alice" }, userType); // [] (valid)
validateType({ name: "Alice", age: 30 }, userType); // [] (valid)
validateType({ age: 30 }, userType); // [{ message: "object value has missing keys" }]
```

## `assertType`

Like `validateType`, but throws an `OwlError` if validation fails instead of
returning the issues list. Accepts an optional error message prefix.

```js
import { types as t, assertType } from "@odoo/owl";

assertType(42, t.number()); // ok, does nothing

assertType("hello", t.number());
// throws: "Value does not match the type\n[...]"

assertType("hello", t.number(), "Invalid config");
// throws: "Invalid config\n[...]"
```

## Validators

Owl exports a `types` object (aliased as `t` below) containing the following
validators. Each validator can be used with `validateType`, `assertType`, or
as a prop type in a component's `props` definition.

```js
import { types as t } from "@odoo/owl";
```

### `t.any()`

Accepts any value without validation.

```js
t.any();
// validates: 42, "hello", null, undefined, ...
```

### `t.boolean()`

Validates that the value is a boolean.

```js
t.boolean();
// validates: true, false
// rejects:   0, "true", null
```

### `t.number()`

Validates that the value is a number.

```js
t.number();
// validates: 42, 3.14, NaN
// rejects:   "42", null
```

### `t.string()`

Validates that the value is a string.

```js
t.string();
// validates: "hello", ""
// rejects:   42, null
```

### `t.array(elementType?)`

Validates that the value is an array. When `elementType` is provided, each
element is validated against it.

```js
t.array(); // any array
t.array(t.number()); // array of numbers
t.array(t.string()); // array of strings

// validates: [1, 2, 3]     with t.array(t.number())
// rejects:   [1, "two", 3] with t.array(t.number())
```

### `t.object(shape?)`

Validates that the value is an object. When a `shape` is provided (either an
object mapping keys to validators, or an array of key names), the object is
checked for the expected keys. Keys ending with `?` are optional. Extra keys
are allowed.

```js
t.object(); // any object
t.object(["name", "age"]); // must have "name" and "age" keys
t.object({ name: t.string(), "age?": t.number() }); // "name" required, "age" optional

// validates: { name: "Alice", age: 30, extra: true }
// rejects:   { age: 30 }  (missing required key "name")
```

### `t.strictObject(shape)`

Like `t.object`, but also rejects unknown keys not present in the schema.
Accepts either an array of key names or an object mapping keys to validators.

```js
t.strictObject(["name", "age"]); // must have exactly "name" and "age" keys
t.strictObject({ name: t.string(), "age?": t.number() }); // "name" required, "age" optional

// validates: { name: "Alice" }
// validates: { name: "Alice", age: 30 }
// rejects:   { name: "Alice", extra: true }  (unknown key "extra")
```

### `t.record(valueType?)`

Validates that the value is an object. When `valueType` is provided, every
value in the object is validated against it.

```js
t.record(); // any object
t.record(t.number()); // all values must be numbers

// validates: { a: 1, b: 2 }     with t.record(t.number())
// rejects:   { a: 1, b: "two" } with t.record(t.number())
```

### `t.tuple(types)`

Validates that the value is an array with a fixed length, where each element
matches its corresponding type.

```js
t.tuple([t.string(), t.number()]);

// validates: ["hello", 42]
// rejects:   ["hello"]           (wrong length)
// rejects:   ["hello", "world"]  (second element is not a number)
```

### `t.function(params?, returnType?)`

Validates that the value is a function. At runtime, only the `typeof` check is
performed — the `params` and `returnType` arguments are **not validated at
runtime**, they only exist to provide TypeScript type inference.

```js
t.function(); // any function
t.function([t.string(), t.number()]); // typed params (TS inference only)
t.function([t.string()], t.boolean()); // typed params and return (TS inference only)

// validates: () => {}, Math.max, class Foo {}
// rejects:   42, "hello", null
```

### `t.promise(type?)`

Validates that the value is a `Promise`. At runtime, only the `instanceof`
check is performed — the `type` argument is **not validated at runtime**, it
only exists to provide TypeScript type inference.

```js
t.promise(); // any promise
t.promise(t.string()); // Promise<string> (TS inference only)

// validates: Promise.resolve(42), new Promise(() => {})
// rejects:   42, { then() {} }
```

### `t.literal(value)`

Validates that the value is strictly equal (`===`) to the given literal.

```js
t.literal("admin");
t.literal(0);
t.literal(null);

// validates: "admin"   with t.literal("admin")
// rejects:   "user"    with t.literal("admin")
```

### `t.selection(values)`

Validates that the value matches one of several literal values. This is
shorthand for `t.or` with `t.literal` for each value.

```js
t.selection(["small", "medium", "large"]);

// validates: "small", "medium", "large"
// rejects:   "xl", 0, null
```

### `t.instanceOf(constructor)`

Validates that the value is an instance of the given constructor.

```js
t.instanceOf(Date);
t.instanceOf(HTMLInputElement);

// validates: new Date()             with t.instanceOf(Date)
// rejects:   Date.now()             with t.instanceOf(Date)
// rejects:   "2024-01-01"           with t.instanceOf(Date)
```

### `t.component()`

Validates that the value is `Component` or a subclass of it. This is shorthand
for `t.constructor(Component)`.

```js
t.component();

// validates: Component, MyComponent (extends Component)
// rejects:   new Component(), "Component"
```

### `t.constructor(constructor)`

Validates that the value is the given constructor itself or a subclass of it.

```js
t.constructor(Error);

// validates: Error, TypeError, RangeError
// rejects:   new Error(), "Error"
```

### `t.signal(type?)`

Validates that the value is a reactive value (signal). The optional `type`
argument is used for type inference only.

```js
t.signal(); // any signal
t.signal(t.number()); // Signal<number> (for TS inference)
```

### `t.ref(type?)`

Validates that the value is either `null` or an instance of `HTMLElement` (or
a subclass). Useful for component ref props.

```js
t.ref(); // null | HTMLElement
t.ref(HTMLInputElement); // null | HTMLInputElement
```

### `t.or(types)`

Validates that the value matches **at least one** of the given types (union).

```js
t.or([t.string(), t.number()]);
t.or([t.literal("none"), t.number()]);

// validates: "hello"  with t.or([t.string(), t.number()])
// validates: 42       with t.or([t.string(), t.number()])
// rejects:   true     with t.or([t.string(), t.number()])
```

### `t.and(types)`

Validates that the value matches **all** of the given types (intersection).

```js
t.and([t.object({ name: t.string() }), t.object({ age: t.number() })]);

// validates: { name: "Alice", age: 30 }
// rejects:   { name: "Alice" }  (missing "age")
```

### `t.customValidator(type, predicate, errorMessage?)`

Validates the value against a base type, then applies a custom predicate
function. If the predicate returns `false`, validation fails with the given
error message (defaults to `"value does not match custom validation"`).

```js
t.customValidator(t.number(), (v) => v >= 0, "value must be non-negative");
t.customValidator(t.string(), (v) => v.length > 0, "value must not be empty");
t.customValidator(t.array(t.number()), (v) => v.length <= 10, "too many items");

// validates: 42    with the first example
// rejects:   -1    with the first example ("value must be non-negative")
// rejects:   "hi"  with the first example (fails base type: "value is not a number")
```
