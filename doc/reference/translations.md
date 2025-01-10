# 🦉 Translations 🦉

If properly setup, Owl can translate all rendered templates. To do
so, it needs a translate function, which takes

- a string (the term to translate)
- a string (the translation context of the term)
  and returns a string.

For example:

```js
const translations = {
  fr: {
    hello: "bonjour",
    yes: "oui",
    no: "non",
  },
  pt: {
    hello: "bom dia",
    yes: "sim",
    no: "não",
  },
};
const translateFn = (str, ctx) => translations[ctx]?.[str] || str;

const app = new App(Root, { templates, tranaslateFn });
// ...
```

See the [app configuration page](app.md#configuration) for more info on how to
configure an Owl application.

Once setup, all rendered templates will be translated using `translateFn`:

- each text node will be replaced with its translation,
- each of the following attribute values will be translated as well: `title`,
  `placeholder`, `label` and `alt`,
- translating text nodes can be disabled with the special attribute `t-translation`,
  if its value is `off`.
- the translate function receives as second parameter a context that can be used
  to contextualized the translation. That context can be set globally on a node
  and its children by using `t-translation-context`. If a specific node
  attribute `x` needs another context, that context can be specified with a
  special directive `t-translation-context-x`.

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

and the following template:

```xml
<div t-translation-context="fr" title="hello">hello</div>
<div>Are you sure?</div>
<input t-translation-context-placeholder="pt" placeholder="hello" other="yes"/>
```

will be rendered as:

```xml
<div title="bonjour">bonjour</div>
<div>Are you sure?</div>
<input placeholder="bom dia" other="yes"/>
```

Note that the translation is done during the compilation of the template, not
when it is rendered.

In some case, it is useful to be able to extend the list of translatable attributes.
For example, one may want to also translate `data-title` attributes. To do that,
we can define additional attributes with the `translatableAttributes` option:

```js
const app = new App(Root, { templates, tranaslateFn, translatableAttributes: ["data-title"] });
// ...
```

It is also possible to remove an attribute from the default list by prefixing it with `-`:

```js
const app = new App(Root, {
  templates,
  tranaslateFn,
  translatableAttributes: ["data-title", "-title"],
});
// data-title attribute will be translated, but not title attribute...
```
