# 🦉 Types Validation 🦉

## Content

- [Overview](#overview)
- [`validateType`](#validatetype)
- [`assertType`](#asserttype)
- [Validators](#validators)

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
    name: t.string,
    "age?": t.number,
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

validateType(42, t.number); // [] (valid)
validateType("hello", t.number); // [{ message: "value is not a number" }]

validateType([1, 2, 3], t.array(t.number)); // [] (valid)
validateType([1, "two"], t.array(t.number)); // [{ message: "value is not a number" }]

const userType = t.object({
  name: t.string,
  "age?": t.number,
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

assertType(42, t.number); // ok, does nothing

assertType("hello", t.number);
// throws: "Value does not match the type\n[...]"

assertType("hello", t.number, "Invalid config");
// throws: "Invalid config\n[...]"
```

## Validators

Owl exports a `types` object containing the following validators:

| Validator                 | Description                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `types.any`               | Accepts any value without validation                                                                               |
| `types.boolean`           | Validates that the value is a boolean                                                                              |
| `types.number`            | Validates that the value is a number                                                                               |
| `types.string`            | Validates that the value is a string                                                                               |
| `types.array()`           | Validates that the value is an array, optionally validating each element against a given type                      |
| `types.object()`          | Validates that the value is an object, optionally checking keys or validating values against a shape               |
| `types.strictObject()`    | Like `object`, but also rejects unknown keys not present in the schema                                             |
| `types.record()`          | Validates that the value is an object, optionally validating all values against a given type                       |
| `types.tuple()`           | Validates that the value is an array with a fixed length and validates each element against its corresponding type |
| `types.function()`        | Validates that the value is a function                                                                             |
| `types.promise()`         | Validates that the value is a Promise                                                                              |
| `types.literal()`         | Validates that the value is strictly equal to a given literal (number, string, boolean, null, or undefined)        |
| `types.selection()`       | Validates that the value matches one of several literal values                                                     |
| `types.instanceOf()`      | Validates that the value is an instance of a given constructor                                                     |
| `types.constructor()`     | Validates that the value is a given constructor or a subclass of it                                                |
| `types.signal()`          | Validates that the value is a reactive value (signal)                                                              |
| `types.ref()`             | Validates that the value is either null or an instance of an HTMLElement (or a subclass)                           |
| `types.or()`              | Validates that the value matches at least one of the given types (union)                                           |
| `types.and()`             | Validates that the value matches all of the given types (intersection)                                             |
| `types.customValidator()` | Validates using a base type, then applies a custom predicate with a custom error message                           |
