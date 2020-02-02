# 🦉 How to write Single File Components 🦉

It is very useful to group code by feature instead of by type of file. It makes
it easier to scale application to larger size.

To do so, Owl has two small helpers that make it easy to define a
template or a stylesheet inside a javascript (or typescript) file: the
[`xml`](../reference/tags.md#xml-tag) and [`css`](../reference/tags.md#css-tag)
helper.

This means that the template, the style and the javascript code can be defined in
the same file. For example:

```js
const { Component } = owl;
const { xml, css } = owl.tags;

// -----------------------------------------------------------------------------
// TEMPLATE
// -----------------------------------------------------------------------------
const TEMPLATE = xml/* xml */ `
	<div class="main">
		<Sidebar/>
		<Content />
	</div>`;

// -----------------------------------------------------------------------------
// STYLE
// -----------------------------------------------------------------------------
const STYLE = css/* css */ `
  .main {
    display: grid;
    grid-template-columns: 200px auto;
  }
`;

// -----------------------------------------------------------------------------
// CODE
// -----------------------------------------------------------------------------
class Main extends Component {
  static template = TEMPLATE;
  static style = STYLE;
  static components = { Sidebar, Content };

  // rest of component...
}
```

Note that the above example has an inline xml comment, just after the `xml` call.
This is useful for some editor plugins, such as the VS Code addon
`Comment tagged template`, which, if installed, add syntax highlighting to the
content of the template string.
