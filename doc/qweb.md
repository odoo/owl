# 🦉 QWeb 🦉

## Content

- [Overview](#overview)
- [QWeb Specification](#qweb-specification)
    - [Static html nodes](#static-html-nodes)
    - [`t-esc` directive](#t-esc-directive)
    - [`t-raw` directive](#t-raw-directive)
    - [`t-set` directive](#t-set-directive)
    - [`t-if` directive](#t-if-directive)
    - [Expression evaluation](#expression-evaluation)
    - [`t-att` directive (dynamic attributes)](#t-att-directive-dynamic-attributes)
- [JS/OWL Specific Extensions](#jsowl-specific-extensions)
    - [`t-on` directive](#t-on-directive)
    - [Component: `t-widget`, `t-props`](#component-t-widget-t-props)
    - [`t-ref` directive](#t-ref-directive)
    - [`t-key` directive](#t-key-directive)
    - [Debugging (`t-debug` and `t-log`)](#debugging-t-debug-and-t-log)
    - [White spaces](#white-spaces)
    - [Root nodes](#root-nodes)

## Overview

[QWeb](https://www.odoo.com/documentation/12.0/reference/qweb.html) is the primary templating engine used by Odoo. It is based on the XML format, and used
mostly to generate html. In OWL, QWeb templates are compiled into functions that
generate a virtual dom representation of the html.

Template directives are specified as XML attributes prefixed with `t-`, for instance `t-if` for conditionals, with elements and other attributes being rendered directly.

To avoid element rendering, a placeholder element `<t>` is also available, which executes its directive but doesn’t generate any output in and of itself.

The QWeb implementation in the OWL project is slightly different. It compiles
templates into functions that output a virtual DOM instead of a string. This is
necessary for the component system. In addition, it has a few extra directives
(see [OWL Specific Extensions](#owlspecificextensions))


## QWeb Specification


### Static html nodes

Normal, regular html nodes are rendered into themselves:

```xml
  <div>hello</div> <!–– rendered as itself ––>
```

### `t-esc` directive

The `t-esc` directive is necessary whenever you want to add a dynamic text
expression in a template. The text is escaped to avoid security issues.

```xml
<p><t t-esc="value"/></p>
```

rendered with the value `value` set to `42` in the rendering context yields:

```html
<p>42</p>
```

### `t-raw` directive

The `t-raw` directive is almost the same as `t-esc`, but without the escaping.
This is mostly useful to inject a raw html string somewhere. Obviously, this
is unsafe to do in general, and should only be used for strings known to be safe.

```xml
<p><t t-esc="value"/></p>
```

rendered with the value `value` set to `<span>foo</span>` in the rendering context yields:

```html
<p><span>foo</span></p>
```

### `t-set` directive

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

### `t-if` directive

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

### Expression evaluation

It is useful to explain the various rules that applies on QWeb expressions. These
expressions are strings that will be converted to a javascript expression at
compile time.

1. it should be a simple expression which returns a value. It cannot be a statement.

   ```xml
   <div><p t-if="1 + 2 === 3">ok</p></div>
   ```

   is valid, but the following is not valid:

   ```xml
   <div><p t-if="console.log(1)">NOT valid</p></div>
   ```

2. it can use anything in the rendering context:

   ```xml
   <p t-if="user.birthday == today()">Happy bithday!</p>
   ```

   is valid, and will read the `user` object from the context, and call the
   `today` function.

3. it can use a few special operators to avoid using symbols such as `<`, `>`,
   `&` or `|`. This is useful to make sure that we still write valid XML.

   | Word  | will be replaced by |
   | ----- | ------------------- |
   | `and` | `&&`                |
   | `or`  | `\|\|`                |
   | `gt`  | `>`                 |
   | `gte` | `>=`                |
   | `lt`  | `<`                 |
   | `lte` | `<=`                |

   So, one can write this:

   ```xml
   <div><p t-if="10 + 2 gt 5">ok</p></div>
   ```

### `t-att` directive (dynamic attributes)

One can use the `t-att-` directive to add dynamic attributes. Its main use is to
evaluate an expression (at rendering time) and bind an attribute to its result:

For example, if we have `id` set to 32 in the rendering context,

```xml
<div t-att-data-action-id="id"/>  <!-- result: <div data-action-id="32"></div> -->
```

If an expression evaluates to a falsy value, it will not be set at all:

```xml
<div t-att-foo="false"/>  <!-- result: <div></div> -->
```

## JS/OWL Specific Extensions

### `t-on` directive

### Component: `t-widget`, `t-props`

### `t-ref` directive

### `t-key` directive

Even though Owl tries to be as declarative as possible, some DOM state is still
locked inside the DOM: for example, the scrolling state, the current user selection,
the focused element or the state of an input. This is why we use a virtual dom
algorithm to keep the actual DOM node as much as possible.  However, this is
sometimes not enough, and we need to help Owl decide if an element is actually
the same, or is different. The `t-key` directive is used to give an identity to an element.

There are three main use cases:

- *elements in a list*:
  ```xml
    <span t-foreach="todos" t-as="todo" t-key="todo.id">
        <t t-esc="todo.text"/>
    </span>
  ```

- *`t-if`/`t-else`*

- *animations*: give a different identity to a component.  Ex: thread id with
animations on add/remove message.

### Debugging (`t-debug` and `t-log`)

The javascript QWeb implementation provides two useful debugging directives:

`t-debug` adds a debugger statement during template rendering:

```xml
<t t-if="a_test">
    <t t-debug="">
</t>
````

will stop execution if the browser dev tools are open.

`t-log` takes an expression parameter, evaluates the expression during rendering and logs its result with console.log:

```xml
<t t-set="foo" t-value="42"/>
<t t-log="foo"/>
```

will print 42 to the console


### White spaces

White spaces in a templates are handled in a special way:

- consecutive whitespaces are always condensed to a single whitespace
- if a whitespace-only text node contains a linebreak, it is ignored
- the previous rules do not apply if we are in a `<pre>` tag

### Root nodes

For many reasons, Owl QWeb templates should have a single root node.  More
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
    <span t-else="1">bar</span>
</t>
```

Extra root nodes will actually be ignored (even though they will be rendered
in memory).

Note: this does not apply to subtemplates (see the `t-call` directive).  In that
case, they will be inlined in the main template, and can actually have many
root nodes.