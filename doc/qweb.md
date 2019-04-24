# 🦉 QWeb 🦉

QWeb is a template specification. The QWeb class in this repository is:

- an implementation of the QWeb specification
- which outputs a virtual dom instead of a string
- and extended with a few extra directives

## QWeb Specification

add here a full description of what QWeb is supposed to be, with some examples

## QWeb Implementation

```javascript
var qweb = new QWeb();
qweb.addTemplate("sometemplate", '<div>hello <t t-esc="name"/></div>');

// result is a vnode which represent <div>hello world</div>
result = qweb.render("sometemplate", { name: "world" });
```

## QWeb extensions

- t-on directive
- t-widget, t-props, t-key
- t-ref

## Note on white spaces

White spaces in a templates are handled in a special way:

- consecutive whitespaces are always condensed to a single whitespace
- if a whitespace-only text node contains a linebreak, it is ignored
- the previous rules do not apply if we are in a `<pre>` tag
