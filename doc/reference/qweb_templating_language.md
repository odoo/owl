# 🦉 QWeb Templating Language🦉

## Content

- [Overview](#overview)
- [Directives](#directives)
- [Reference](#reference)
  - [White Spaces](#white-spaces)
  - [Root Nodes](#root-nodes)
  - [Expression Evaluation](#expression-evaluation)
  - [Static html Nodes](#static-html-nodes)
  - [Outputting Data](#outputting-data)
  - [Setting Variables](#setting-variables)
  - [Conditionals](#conditionals)
  - [Dynamic Attributes](#dynamic-attributes)
  - [Loops](#loops)
  - [Rendering Sub Templates](#rendering-sub-templates)
  - [Translations](#translations)
  - [Debugging](#debugging)

## Overview

[QWeb](https://www.odoo.com/documentation/13.0/reference/qweb.html) is the primary
templating engine used by Odoo. It is based on the XML format, and used
mostly to generate HTML. In OWL, QWeb templates are compiled into functions that
generate a virtual dom representation of the HTML.

```xml
<div>
    <span t-if="somecondition">Some string</span>
    <ul t-else="">
        <li t-foreach="messages" t-as="message">
            <t t-esc="message"/>
        </li>
    </ul>
</div>
```

Template directives are specified as XML attributes prefixed with `t-`, for
instance `t-if` for conditionals, with elements and other attributes being
rendered directly.

To avoid element rendering, a placeholder element `<t>` is also available, which
executes its directive but doesn’t generate any output in and of itself.

We present in this section the templating language, including its Owl specific
extensions.

## Directives

For reference, here is a list of all standard QWeb directives:

| Name                           | Description                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `t-esc`                        | [Outputting safely a value](#outputting-data)                  |
| `t-raw`                        | [Outputting value, without escaping](#outputting-data)         |
| `t-set`, `t-value`             | [Setting variables](#setting-variables)                        |
| `t-if`, `t-elif`, `t-else`,    | [conditionally rendering](#conditionals)                       |
| `t-foreach`, `t-as`            | [Loops](#loops)                                                |
| `t-att`, `t-attf-*`, `t-att-*` | [Dynamic attributes](#dynamic-attributes)                      |
| `t-call`                       | [Rendering sub templates](#rendering-sub-templates)            |
| `t-debug`, `t-log`             | [Debugging](#debugging)                                        |
| `t-translation`                | [Disabling the translation of a node](#translations)           |
| `t-name`                       | [Defining a template (not really a directive)](qweb_engine.md) |

The component system in Owl requires additional directives, to express various
needs. Here is a list of all Owl specific directives:

| Name                     | Description                                                                     |
| ------------------------ | ------------------------------------------------------------------------------- |
| `t-component`, `t-props` | [Defining a sub component](component.md#composition)                            |
| `t-ref`                  | [Setting a reference to a dom node or a sub component](component.md#references) |
| `t-key`                  | [Defining a key (to help virtual dom reconciliation)](#loops)                   |
| `t-on-*`                 | [Event handling](component.md#event-handling)                                   |
| `t-transition`           | [Defining an animation](animations.md#css-transitions)                          |
| `t-slot`                 | [Rendering a slot](slots.md)                                                    |
| `t-model`                | [Form input bindings](component.md#form-input-bindings)                         |

## Reference

### White Spaces

White spaces in a template are handled in a special way:

- consecutive whitespaces are always condensed to a single whitespace
- if a whitespace-only text node contains a linebreak, it is ignored
- the previous rules do not apply if we are in a `<pre>` tag

### Root Nodes

For many reasons, Owl QWeb templates should have a single root node. More
precisely, the result of a template rendering should have a single root node:

```xml
<!–– not ok: two root nodes ––>
<t>
    <div>foo</div>
    <div>bar</div>
</t>

<!–– ok: result has one single root node ––>
<t>
    <div t-if="someCondition">foo</div>
    <span t-else="">bar</span>
</t>
```

Extra root nodes will actually be ignored (even though they will be rendered
in memory).

Note: this does not apply to subtemplates (see the `t-call` directive). In that
case, they will be inlined in the main template, and can actually have many
root nodes.

### Expression Evaluation

QWeb expressions are strings that will be processed at compile time. Each variable in
the javascript expression will be replaced with a lookup in the context (so, the
component). For example, `a + b.c(d)` will be converted into:

```js
context["a"] + context["b"].c(context["d"]);
```

It is useful to explain the various rules that apply on these expressions:

1. it should be a simple expression which returns a value. It cannot be a statement.

   ```xml
   <div><p t-if="1 + 2 === 3">ok</p></div>
   ```

   is valid, but the following is not valid:

   ```xml
   <div><p t-if="console.log(1)">NOT valid</p></div>
   ```

2. it can use anything in the rendering context (typically, the component):

   ```xml
   <p t-if="user.birthday === today()">Happy bithday!</p>
   ```

   is valid, and will read the `user` object from the context, and call the
   `today` function.

3. it can use a few special operators to avoid using symbols such as `<`, `>`,
   `&` or `|`. This is useful to make sure that we still write valid XML.

   | Word  | replaced with |
   | ----- | ------------- |
   | `and` | `&&`          |
   | `or`  | `\|\|`        |
   | `gt`  | `>`           |
   | `gte` | `>=`          |
   | `lt`  | `<`           |
   | `lte` | `<=`          |

   So, one can write this:

   ```xml
   <div><p t-if="10 + 2 gt 5">ok</p></div>
   ```

### Static Html Nodes

Normal, regular html nodes are rendered into themselves:

```xml
  <div>hello</div> <!–– rendered as itself ––>
```

### Outputting Data

The `t-esc` directive is necessary whenever you want to add a dynamic text
expression in a template. The text is escaped to avoid security issues.

```xml
<p><t t-esc="value"/></p>
```

rendered with the value `value` set to `42` in the rendering context yields:

```html
<p>42</p>
```

The `t-raw` directive is almost the same as `t-esc`, but without the escaping.
This is mostly useful to inject a raw html string somewhere. Obviously, this
is unsafe to do in general, and should only be used for strings known to be safe.

```xml
<p><t t-raw="value"/></p>
```

rendered with the value `value` set to `<span>foo</span>` in the rendering context yields:

```html
<p><span>foo</span></p>
```

Note that since the content of the expression is not known beforehand, the `t-raw`
directive has to parse the html (and convert it to a virtual dom structure) for
each rendering. So, it will be much slower than a regular template. It is
therefore advised to limit the use of `t-raw` whenever possible.

### Setting Variables

QWeb allows creating variables from within the template, to memoize a computation (to use it multiple times), give a piece of data a clearer name, ...

This is done via the `t-set` directive, which takes the name of the variable to create. The value to set can be provided in two ways:

1. a `t-value` attribute containing an expression, and the result of its
   evaluation will be set:

   ```xml
   <t t-set="foo" t-value="2 + 1"/>
   <t t-esc="foo"/>
   ```

   will print `3`. Note that the evaluation is done at rendering time, not at
   compilte time.

2. if there is no `t-value` attribute, the node’s body is saved and its value is
   set as the variable’s value:

   ```xml
   <t t-set="foo">
       <li>ok</li>
   </t>
   <t t-esc="foo"/>
   ```

   will generate `&lt;li&gt;ok&lt;/li&gt;` (the content is escaped as we used the `t-esc` directive)

The `t-set` directive acts like a regular variable in most programming language.
It is lexically scoped (inner nodes are sub scopes), can be shadowed, ...

### Conditionals

The `t-if` directive is useful to conditionally render something. It evaluates
the expression given as attribute value, and then acts accordingly.

```xml
<div>
    <t t-if="condition">
        <p>ok</p>
    </t>
</div>
```

The element is rendered if the condition (evaluated with the current rendering
context) is true:

```xml
<div>
    <p>ok</p>
</div>
```

but if the condition is false it is removed from the result:

```xml
<div>
</div>
```

The conditional rendering applies to the bearer of the directive, which does not
have to be `<t>`:

```xml
<div>
    <p t-if="condition">ok</p>
</div>
```

will give the same results as the previous example.

Extra conditional branching directives `t-elif` and `t-else` are also available:

```xml
<div>
    <p t-if="user.birthday == today()">Happy bithday!</p>
    <p t-elif="user.login == 'root'">Welcome master!</p>
    <p t-else="">Welcome!</p>
</div>
```

### Dynamic Attributes

One can use the `t-att-` directive to add dynamic attributes. Its main use is to
evaluate an expression (at rendering time) and bind an attribute to its result:

For example, if we have `id` set to 32 in the rendering context,

```xml
<div t-att-data-action-id="id"/> <!-- result: <div data-action-id="32"></div> -->
```

If an expression evaluates to a falsy value, it will not be set at all:

```xml
<div t-att-foo="false"/>  <!-- result: <div></div> -->
```

It is sometimes convenient to format an attribute with string interpolation. In
that case, the `t-attf-` directive can be used. It is useful when we need to mix
literal and dynamic elements, such as css classes.

```xml
<div t-attf-foo="a {{value1}} is {{value2}} of {{value3}} ]"/>
<!-- result if values are set to 1,2 and 3: <div foo="a 0 is 1 of 2 ]"></div> -->
```

If we need completely dynamic attribute names, then there is an additional
directive: `t-att`, which takes either an object (with keys mapping to their
values) or a pair `[key, value]`. For example:

```xml
<div t-att="{'a': 1, 'b': 2}"/> <!-- result: <div a="1" b="2"></div> -->

<div t-att="['a', 'b']"/> <!-- <div a="b"></div> -->
```

### Loops

QWeb has an iteration directive `t-foreach` which take an expression returning the
collection to iterate on, and a second parameter `t-as` providing the name to use
for the current item of the iteration:

```xml
<t t-foreach="[1, 2, 3]" t-as="i">
    <p><t t-esc="i"/></p>
</t>
```

will be rendered as:

```xml
<p>1</p>
<p>2</p>
<p>3</p>
```

Like conditions, `t-foreach` applies to the element bearing the directive’s attribute, and

```xml
<p t-foreach="[1, 2, 3]" t-as="i">
    <t t-esc="i"/>
</p>
```

is equivalent to the previous example.

`t-foreach` can iterate on an array (the current item will be the current value)
or an object (the current item will be the current key).

In addition to the name passed via t-as, `t-foreach` provides a few other
variables for various data points (note: `$as` will be replaced with the name
passed to `t-as`):

- `$as_value`: the current iteration value, identical to `$as` for lists and
  integers, but for objects, it provides the value (where `$as` provides the key)
- `$as_index`: the current iteration index (the first item of the iteration has index 0)
- `$as_first`: whether the current item is the first of the iteration
  (equivalent to `$as_index == 0`)
- `$as_last`: whether the current item is the last of the iteration
  (equivalent to `$as_index + 1 == $as_size`), requires the iteratee’s size be
  available

These extra variables provided and all new variables created into the `t-foreach`
are only available in the scope of the `t-foreach`. If the variable exists outside
the context of the `t-foreach`, the value is copied at the end of the foreach
into the global context.

```xml
<t t-set="existing_variable" t-value="false"/>
<!-- existing_variable now False -->

<p t-foreach="Array(3)" t-as="i">
    <t t-set="existing_variable" t-value="true"/>
    <t t-set="new_variable" t-value="true"/>
    <!-- existing_variable and new_variable now true -->
</p>

<!-- existing_variable always true -->
<!-- new_variable undefined -->
```

Even though Owl tries to be as declarative as possible, the DOM does not fully
expose its state declaratively in the DOM tree. For example, the scrolling state,
the current user selection, the focused element or the state of an input are not
set as attribute in the DOM tree. This is why we use a virtual dom
algorithm to keep the actual DOM node as much as possible.

However, in some situations, this is not enough, and we need to help Owl decide
if an element is actually the same, or is a different element with the same
properties.

Consider the following situation: we have a list of two items `[{text: "a"}, {text: "b"}]`
and we render them in this template:

```xml
<p t-foreach="items" t-as="item"><t t-esc="item.text"/></p>
```

The result will be two `<p>` tags with text `a` and `b`. Now, if we swap them,
and rerender the template, Owl needs to know what the intent is:

- should Owl actually swap the DOM nodes,
- or should it keep the DOM nodes, but with an updated text content?

This might look trivial, but it actually matters. These two possibilities lead
to different results in some cases. For example, if the user selected the text
of the first `p`, swapping them will keep the selection while updating the
text content will not.

There are many other cases where this is important: `input` tags with their
value, css classes and animations, scroll position...

So, the `t-key` directive is used to give an identity to an element. It allows
Owl to understand if different elements of a list are actually different or not.

The above example could be modified by adding an ID: `[{id: 1, text: "a"}, {id: 2, text: "b"}]`.
Then, the template could look like this:

```xml
<p t-foreach="items" t-as="item" t-key="item.id"><t t-esc="item.text"/></p>
```

The `t-key` directive is useful for lists (`t-foreach`). A key should be
a unique number or string (objects will not work: they will be cast to the
`"[object Object]"` string, which is obviously not unique).

Also, the key can be set on a `t` tag or on its children. The following variations
are all equivalent:

```xml
<p t-foreach="items" t-as="item" t-key="item.id">
  <t t-esc="item.text"/>
</p>

<t t-foreach="items" t-as="item" t-key="item.id">
  <p t-esc="item.text"/>
</t>

<t t-foreach="items" t-as="item">
  <p t-key="item.id" t-esc="item.text"/>
</t>
```

If there is no `t-key` directive, Owl will use the index as a default key.

### Rendering Sub Templates

QWeb templates can be used for top level rendering, but they can also be used
from within another template (to avoid duplication or give names to parts of
templates), using the `t-call` directive:

```xml
<div t-name="other-template">
    <p><t t-value="var"/></p>
</div>

<div t-name="main-template">
    <t t-set="var" t-value="owl"/>
    <t t-call="other-template"/>
</div>
```

will be rendered as `<div><p>owl</p></div>`. This example shows that the sub
template is rendered with the execution context of the parent. The sub template
is actually inlined in the main template, but in a sub scope: variables defined
in the sub template do not escape.

Sometimes, one might want to pass information to the sub template. In that case,
the content of the body of the `t-call` directive is available as a special
magic variable `0`:

```xml
<t t-name="other-template">
    This template was called with content:
    <t t-raw="0"/>
</t>

<div t-name="main-template">
    <t t-call="other-template">
        <em>content</em>
    </t>
</div>
```

will result in :

```xml
<div>
    This template was called with content:
    <em>content</em>
</div>
```

This can be used to define variables scoped to a sub template:

```xml
<t t-call="other-template">
    <t t-set="var" t-value="1"/>
</t>
<!-- "var" does not exist here -->
```

### Translations

By default, QWeb specify that templates should be translated. If this behaviour
is not wanted, there is a `t-translation` directive which can turn off
translations (if it is set to the `off` value), with the following rules:

- each text node will be replaced with its translation,
- each of the following attribute values will be translated as well: `title`,
  `placeholder`, `label` and `alt`,
- translating text nodes can be disabled with the special attribute `t-translation`,
  if its value is `off`.

See [here](qweb_engine.md#translations) for more information on how to setup a
translate function in Owl QWeb.

### Debugging

The javascript QWeb implementation provides two useful debugging directives:

`t-debug` adds a debugger statement during template rendering:

```xml
<t t-if="a_test">
    <t t-debug="">
</t>
```

will stop execution if the browser dev tools are open.

`t-log` takes an expression parameter, evaluates the expression during rendering and logs its result with console.log:

```xml
<t t-set="foo" t-value="42"/>
<t t-log="foo"/>
```

will print 42 to the console.
