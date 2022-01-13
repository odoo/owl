# 🦉 Translations 🦉

take care of this and "cherry-pick" 8464a1b04e7469434f9dcb3d68a543f58cb61b8e

If properly setup, Owl QWeb engine can translate all rendered templates. To do
so, it needs a translate function, which takes a string and returns a string.

For example:

```js
const translations = {
  hello: "bonjour",
  yes: "oui",
  no: "non",
};
const translateFn = (str) => translations[str] || str;

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
