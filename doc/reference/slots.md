# 🦉 Slots 🦉

## Content

- [Overview](#overview)
- [Example](#example)
- [Reference](#reference)

## Overview

Owl is a template based component system. There is therefore a need to be able
to make generic components. For example, imagine a generic `Dialog`
component, which is able to display some arbitrary content.

Obviously, we want to use this component everywhere in our application, to
display various different content. The `Dialog` component is technically the
owner of its content, but is only a container. The user of the `Dialog` is
the component that want to _inject_ something inside the `Dialog`. This is
exactly what slots are for.

## Example

To make generic components, it is useful to be able for a parent component to _inject_
some sub template, but still be the owner. For example, a generic dialog component
will need to render some content, some footer, but with the parent as the
rendering context.

```xml
<div t-name="Dialog" class="modal">
  <div class="modal-title"><t t-esc="props.title"/></div>
  <div class="modal-content">
    <t t-slot="content"/>
  </div>
  <div class="modal-footer">
    <t t-slot="footer"/>
  </div>
</div>
```

Slots are defined by the caller, with the `t-set` directive:

```xml
<div t-name="SomeComponent">
  <div>some component</div>
  <Dialog title="Some Dialog">
    <t t-set="content">
      <div>hey</div>
    </t>
    <t t-set="footer">
      <button t-on-click="doSomething">ok</button>
    </t>
  </Dialog>
</div>
```

In this example, the component `Dialog` will render the slots `content` and `footer`
with its parent as rendering context. This means that clicking on the button
will execute the `doSomething` method on the parent, not on the dialog.

## Reference

Default slot: the first element inside the component which is not a named slot will
be considered the `default` slot. For example:

```xml
<div t-name="Parent">
  <Child>
    <span>some content</span>
  </Child>
</div>

<div t-name="Child">
  <t t-slot="default"/>
</div>
```

Default content: slots can define a default content, in case the parent did not define them:

```xml
<div t-name="Parent">
  <Child/>
</div>

<span t-name="Child">
  <t t-slot="default">default content</t>
</span>
<!-- will be rendered as: <div><span>default content</span></div> -->
```

Rendering context: the content of the slots is actually rendered with the
rendering context corresponding to where it was defined, not where it is
positioned. This allows the user to define event handlers that will be bound
to the correct component (usually, the grandparent of the slot content).
