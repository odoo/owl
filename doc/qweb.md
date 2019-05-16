# 🦉 QWeb 🦉

## Content

- [Overview](#overview)
- [QWeb Engine](#qweb-engine)
- [QWeb Specification](#qweb-specification)

  - [Static html nodes](#static-html-nodes)
  - [`t-esc` directive](#t-esc-directive)
  - [`t-raw` directive](#t-raw-directive)
  - [`t-set` directive](#t-set-directive)
  - [`t-if` directive](#t-if-directive)
  - [Expression evaluation](#expression-evaluation)
  - [`t-att` directive (dynamic attributes)](#t-att-directive-dynamic-attributes)
  - [`t-call` directive (sub templates)](#t-call-directive-sub-templates)

- [JS/OWL Specific Extensions](#jsowl-specific-extensions)

  - [`t-on` directive](#t-on-directive)
  - [Component: `t-widget`, `t-props`](#component-t-widget-t-props)
  - [`t-ref` directive](#t-ref-directive)
  - [`t-key` directive](#t-key-directive)
  - [`t-transition` directive](#t-transition-directive)
  - [`t-mounted` directive](#t-mounted-directive)
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

## QWeb Engine

This section is about the javascript code that implements the `QWeb` specification.
Owl exports a `QWeb` class in `owl.QWeb`. To use it, it just needs to be
instantiated:

```js
const qweb = new owl.QWeb();
```

It's API is quite simple:

- **`constructor(data)`**: constructor. Takes an optional string to add initial
  templates (see `addTemplates` for more information on format of the string).

  ```js
  const qweb = new owl.QWeb(TEMPLATES);
  ```

- **`addTemplate(name, xmlStr)`**: add a specific template.

  ```js
  qweb.addTemplate("mytemplate", "<div>hello</div>");
  ```

- **`addTemplates(xmlStr)`**: add a list of templates (identified by `t-name`
  attribute).

  ```js
  const TEMPLATES = `
    <templates>
      <div t-name="App" class="main">main</div>
      <div t-name="OtherWidget">other widget</div>
    </templates>`;
  qweb.addTemplates(TEMPLATES);
  ```

- **`render(name, context, extra)`**: renders a template. This returns a `vnode`,
  which is a virtual representation of the DOM (see [vdom doc](vdom.md)).

  ```js
  const vnode = qweb.render("App", widget);
  ```

## QWeb Specification

We define in this section the specification of how `QWeb` templates should be
rendered.

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
   | `or`  | `\|\|`              |
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

### `t-call` directive (sub templates)

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

## JS/OWL Specific Extensions

### `t-on` directive

In a component's template, it is useful to be able to register handlers on some
elements to some specific events. This
is what makes a template _alive_. There are two different use cases.

1. Register an event handler on a DOM node

   ```xml
   <button t-on-click="someMethod">Do something</button>
   ```

   This will be roughly translated in javascript like this:

   ```js
   button.addEventListener("click", widget.someMethod.bind(widget));
   ```

   The suffix (`click` in this example) is simply the name of the actual DOM
   event.

2. Register an event handler on a component. This will not capture a DOM event,
   but rather a _business_ event:

   ```xml
   <t t-widget="MyWidget" t-on-menuLoaded="someMethod"/>
   ```

   ```js
   class MyWidget {
       someWhere() {
           const payload = ...;
           this.trigger('menuLoaded', payload);
       }
   }
   ```

   Here, the parent widget will receive the payload in its `someMethod` handler,
   whenever the event is triggered.

The `t-on` directive also allows to prebind some arguments. For example,

```xml
<button t-on-click="someMethod(expr)">Do something</button>
```

Here, `expr` is a valid Owl expression, so it could be `true` or some variable
from the rendering context.

### Component: `t-widget`, `t-props`

The `t-widget` and the `t-props` directives are the key to a declarative component
system. They allow a template to define where and how a sub widget is created
and/or updated. For example:

```xml
<div t-name="ParentWidget">
    <t t-widget="ChildWidget" t-props="{count: state.val}"/>
</div>
```

```js
class ParentWidget {
  widgets = { ChildWidget };
  state = { val: 4 };
}
```

Whenever the template is rendered, it will automatically create the subwidget
`ChildWidget` at the correct place. It needs to find the reference to the
actual component class in the special `widgets` key.

In this example, the child widget will receive the object `{count: 4}` in its
constructor. This will be assigned to the `props` variable, which can be accessed
on the widget (and also, in the template). Whenever the state is updated, then
the subwidget will also be updated automatically.

### `t-ref` directive

The `t-ref` directive helps a component keep reference to some inside part of it.
Like the `t-on` directive, it can work either on a DOM node, or on a component:

```xml
<div>
    <div t-ref="someDiv"/>
    <t t-widget="SubWidget" t-ref="someWidget"/>
</div>
```

In this example, the widget will be able to access the `div` and the component
inside the special `refs` variable:

```js
this.refs.someDiv;
this.refs.someWidget;
```

This is useful for various usecases: for example, integrating with an external
library that needs to render itself inside an actual DOM node. Or for calling
some method on a sub widget.

Note: if used on a component, the reference will be set in the `refs`
variable between `willPatch` and `patched`.

### `t-key` directive

Even though Owl tries to be as declarative as possible, some DOM state is still
locked inside the DOM: for example, the scrolling state, the current user selection,
the focused element or the state of an input. This is why we use a virtual dom
algorithm to keep the actual DOM node as much as possible. However, this is
sometimes not enough, and we need to help Owl decide if an element is actually
the same, or is different. The `t-key` directive is used to give an identity to an element.

There are three main use cases:

- _elements in a list_:

  ```xml
    <span t-foreach="todos" t-as="todo" t-key="todo.id">
        <t t-esc="todo.text"/>
    </span>
  ```

- _`t-if`/`t-else`_

- _animations_: give a different identity to a component. Ex: thread id with
  animations on add/remove message.

### `t-transition` directive

To perform useful transition effects, whenever an element appears or disappears,
it is necessary to add/remove some css style or class at some precise moment in
the lifetime of a node. Since this is not easy to do by hand, Owl `t-transition`
directive is there to help.

Whenever a node has a `t-transition` directive, with a `name` value, the following
will happen:

At node creation:

- the css classes `name-enter` and `name-enter-active` will be added before the
  node is added to the DOM,
- on the next animation frame: the css class `name-enter` will be removed and the
  class `name-enter-to` will be added (so they can be used to trigger css
  transition effects),
- the css class `name-enter-active` will be removed whenever a css transition
  ends.

At node destruction:

- the css classes `name-leave` and `name-leave-active` will be added before the
  node is removed to the DOM,
- the css class `name-leave` will be removed on the next animation frame (so it
  can be used to trigger css transition effects),
- the css class `name-leave-active` will be removed whenever a css transition
  ends. Only then will the element be removed from the DOM.

For example, a simple fade in/out effect can be done with this:

```xml
<div>
    <div t-if="state.flag" class="square" t-transition="fade">Hello</div>
</div>
```

```css
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter,
.fade-leave-to {
  opacity: 0;
}
```

Note: more information on animations are available [here](doc/animations.md).

### `t-mounted` directive

The `t-mounted` directive allows to register a callback to execute whenever the node
is inserted into the DOM.

```xml
<div><input t-ref="someInput" t-mounted="focusMe"/></div>
```

```js
class MyWidget extends owl.Component {
    ...
    focusMe() {
        this.refs.someInput.focus();
    }
}
```

### Debugging (`t-debug` and `t-log`)

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

will print 42 to the console

### White spaces

White spaces in a templates are handled in a special way:

- consecutive whitespaces are always condensed to a single whitespace
- if a whitespace-only text node contains a linebreak, it is ignored
- the previous rules do not apply if we are in a `<pre>` tag

### Root nodes

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
    <span t-else="1">bar</span>
</t>
```

Extra root nodes will actually be ignored (even though they will be rendered
in memory).

Note: this does not apply to subtemplates (see the `t-call` directive). In that
case, they will be inlined in the main template, and can actually have many
root nodes.
