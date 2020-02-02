# 🦉 QWeb Engine 🦉

## Content

- [Overview](#overview)
- [Reference](#reference)

## Overview

[QWeb](https://www.odoo.com/documentation/13.0/reference/qweb.html) is the primary
templating engine used by Odoo. The QWeb class in the OWL project is an
implementation of that specification with a few interesting points:

- it compiles templates into functions that output a virtual DOM instead of a
  string. This is necessary for the component system.
- it has a few extra directives: `t-component`, `t-on`, ...

We present in this section the engine, not the templating language.

## Reference

This section is about the javascript code that implements the `QWeb` specification.
Owl exports a `QWeb` class in `owl.QWeb`. To use it, it just needs to be
instantiated:

```js
const qweb = new owl.QWeb();
```

Its API is quite simple:

- **`constructor(config)`**: constructor. Takes an optional configuration object
  with an optional `templates` string to add initial
  templates (see `addTemplates` for more information on format of the string)
  and an optional `translateFn` translate function (see the section on
  [translations](#translations)).

  ```js
  const qweb = new owl.QWeb({ templates: TEMPLATES, translateFn: _t });
  ```

- **`addTemplate(name, xmlStr, allowDuplicate)`**: add a specific template.

  ```js
  qweb.addTemplate("mytemplate", "<div>hello</div>");
  ```

  If the optional `allowDuplicate` is set to `true`, then `QWeb` will simply
  ignore templates added for a second time. Otherwise, `QWeb` will crash.

- **`addTemplates(xmlStr)`**: add a list of templates (identified by `t-name`
  attribute).

  ```js
  const TEMPLATES = `
    <templates>
      <div t-name="App" class="main">main</div>
      <div t-name="OtherComponent">other component</div>
    </templates>`;
  qweb.addTemplates(TEMPLATES);
  ```

- **`render(name, context, extra)`**: renders a template. This returns a `vnode`,
  which is a virtual representation of the DOM (see [vdom doc](../miscellaneous/vdom.md)).

  ```js
  const vnode = qweb.render("App", component);
  ```

- **`renderToString(name, context)`**: renders a template, but returns an html
  string.

  ```js
  const str = qweb.renderToString("someTemplate", somecontext);
  ```

- **`registerTemplate(name, template)`**: static function to register a global
  QWeb template. This is useful for commonly used components accross the
  application, and for making a template available to an application without
  having a reference to the actual QWeb instance.

  ```js
  QWeb.registerTemplate("mytemplate", `<div>some template</div>`);
  ```

- **`registerComponent(name, Component)`**: static function to register an OWL Component
  to QWeb's global registry. Globally registered Components can be used in
  templates (see the `t-component` directive). This is useful for commonly used
  components accross the application.

  ```js
  class Dialog extends owl.Component { ... }
  QWeb.registerComponent("Dialog", Dialog);

  ...

  class ParentComponent extends owl.Component { ... }
  qweb.addTemplate("ParentComponent", "<div><Dialog/></div>");
  ```

In some way, a `QWeb` instance is the core of an Owl application. It is the only
mandatory element of an [environment](environment.md). As such, it
has an extra responsibility: it can act as an event bus for internal communication
between Owl classes. This is the reason why `QWeb` actually extends [EventBus](event_bus.md).

### Translations

If properly setup, Owl QWeb engine can translate all rendered templates. To do
so, it needs a translate function, which takes a string and returns a string.

For example:

```js
const translations = {
  hello: "bonjour",
  yes: "oui",
  no: "non"
};
const translateFn = str => translations[str] || str;

const qweb = new QWeb({ translateFn });
```

Once setup, all rendered templates will be translated using `translateFn`:

- each text node will be replaced with its translation,
- each of the following attribute values will be translated as well: `title`,
  `placeholder`, `label` and `alt`,
- translating text nodes can be disabled with the special attribute `t-translation`,
  if its value is `off`.

So, with the above `translateFn`, the following templates:

```xml
<div>hello</div>
<div t-translation="off">hello</div>
<div>Are you sure?</div>
<input placeholder="hello" other="yes"/>
```

will be rendered as:

```xml
<div>bonjour</div>
<div>hello</div>
<div>Are you sure?</div>
<input placeholder="bonjour" other="yes"/>
```

Note that the translation is done during the compilation of the template, not
when it is rendered.
