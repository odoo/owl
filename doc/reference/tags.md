# 🦉 Tags 🦉

## Content

- [Overview](#overview)
- [`xml` tag](#xml-tag)
- [`css` tag](#css-tag)

## Overview

Tags are very small helpers intended to make it easy to write inline templates
or styles. There are currently two tags: `css` and `xml`. With these functions,
it is possible to write [single file components](../tooling.md#single-file-component).

## XML tag

The `xml` tag is certainly the most useful tag. It is used to define an inline
QWeb template for a component. Without tags, creating a standalone component
would look like this:

```js
import { Component } from 'owl'

const name = 'some-unique-name';
const template = `
    <div>
        <span t-if="somecondition">text</span>
        <button t-on-click="someMethod">Click</button>
    </div>
`;
QWeb.registerTemplate(name, template);

class MyComponent extends Component {
    static template = name;

    ...
}
```

With tags, this process is slightly simplified. The name is uniquely generated,
and the template is automatically registered:

```js
const { Component } = owl;
const { xml } = owl.tags;

class MyComponent extends Component {
    static template = xml`
        <div>
            <span t-if="somecondition">text</span>
            <button t-on-click="someMethod">Click</button>
        </div>
    `;

    ...
}
```

## CSS tag

The CSS tag is useful to define a css stylesheet in the javascript file:

```js
class MyComponent extends Component {
    static template = xml`
        <div class="my-component">some template</div>
    `;
    static css`
      .my-component {
          color: red;
      }
    `;
}
```

The `css` tag registers internally the css information. Then, whenever the first
instance of the component is created, will add a `<style>` tag to the document
`<head>`.

Note that to make it more useful, like other css preprocessors, the `css` tag
accepts a small extension of the css specification: css scopes can be nested,
and the rules will then be expanded by the `css` helper:

```scss
.my-component {
  display: block;
  .sub-component h {
    color: red;
  }
}
```

will be formatted as:

```css
.my-component {
  display: block;
}
.my-component .sub-component h {
  color: red;
}
```

This extension brings another useful feature: the `&` selector which refers to
the parent selector. For example, we want our component to be red when hovered.
We would like to write something like:

```scss
.my-component {
  display: block;
  :hover {
    color: red;
  }
}
```

but it will be formatted as:

```css
.my-component {
  display: block;
}
.my-component :hover {
  color: red;
}
```

The `&` selector can be used to solve this problem:

```scss
.my-component {
  display: block;
  &:hover {
    color: red;
  }
}
```

will be formatted as:

```css
.my-component {
  display: block;
}
.my-component:hover {
  color: red;
}
```

Now, there is no additional processing done by the `css` tag. However, since it
is done in javascript at runtime, we actually have more power. For example:

1. sharing values between javascript and css:

```js
import { theme } from "./theme";

class MyComponent extends Component {
  static template = xml`<div class="my-component">...</div>`;
  static style = css`
    .my-component {
      color: ${theme.MAIN_COLOR};
      background-color: ${theme.SECONDARY_color};
    }
  `;
}
```

2. scoping rules to the current component:

```js
import { generateUUID } from "./utils";

const uuid = generateUUID();

class MyComponent extends Component {
  static template = xml`<div data-o-${uuid}="">...</div>`;
  static style = css`
        [data-o-${uuid}] {
            color: red;
        }
    `;
}
```
