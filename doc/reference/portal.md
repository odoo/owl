# 🦉 Portal 🦉

It is sometimes useful to be able to render some content outside the boundaries
of a component. To do that, Owl provides a special directive: `t-portal`:

```js
class SomeComponent extends Component {
  static template = xml`
      <div>this is inside the component</div>
      <div t-portal="'body'">and this is outside</div>
    `;
}
```

The `t-portal` directive takes a valid css selector as argument. The content of
the portalled template will be mounted at the corresponding location. Note that
Owl need to insert an empty text node at the location of the portalled content.

The `t-portal` directive supports a `.closest` modifier. It is useful to select
the closest target from the portal location: Owl will look for a target in the
current parent element, then in its parent, and so on until it finds it.

```xml
      <div t-portal.closest="'.target'">some content</div>
```
