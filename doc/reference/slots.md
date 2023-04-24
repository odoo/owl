# 🦉 Slots 🦉

## Content

- [Overview](#overview)
- [Named slots](#named-slots)
- [Rendering Context](#rendering-context)
- [Default Slot](#default-slot)
- [Default Content](#default-content)
- [Dynamic slots](#dynamic-slots)
- [Slots and props](#slots-and-props)
- [Slot params](#slot-params)
- [Slot scopes](#slot-scopes)

## Overview

Owl is a template based component system. There is therefore a need to be able
to make generic components. For example, imagine a generic `Navbar`
component, which displays a navbar, but with some customizable content. Since
the specific content is only known to the user of the `Navbar`, it would be nice
to specify it in the template where `Navbar` is used:

```xml
  <div>
    <Navbar>
      <span>Hello Owl</span>
    </Navbar>
  </div>
```

This is exactly the way slots work! In the example above, the user of the `Navbar`
component specify some content (here, in the default slot). The `Navbar`
component can insert that content in its own template at the appropriate location.
An important information to notice is that the content of the slot is rendered in
the parent context, not in the navbar. As such, it can access values and methods
from the parent component.

Here is how the `Navbar` component could be defined, with the `t-slot` directive:

```xml
<div class="navbar">
  <t t-slot="default"/>
  <ul>
    <!-- rest of the navbar here -->
  </ul>
</div>
```

## Named slots

Default slots are very useful, but sometimes, we may need more than one slot.
This is what named slots are for! For example, suppose we implement a component
`InfoBox` that display a title and some specific content. Its template could look
like this:

```xml
<div class="info-box">
  <div class="info-box-title">
    <t t-slot="title"/>
    <span class="info-box-close-button" t-on-click="close">X</span>
  </div>
  <div class="info-box-content">
    <t t-slot="content"/>
  </div>
</div>
```

And one could use it with the `t-set-slot` directive:

```xml
<InfoBox>
  <t t-set-slot="title">
    Specific Title. It could be html also.
  </t>
  <t t-set-slot="content">
    <!-- some template here, with html, events, whatever -->
  </t>
</InfoBox>
```

## Rendering context

The content of the slots is actually rendered with the rendering context corresponding
to where it was defined, not where it is positioned. This allows the user to define
event handlers that will be bound to the correct component (usually, the
grandparent of the slot content).

## Default Slot

All elements inside the component which are not a named slot will be treated as
part of the content of the `default` slot. For example:

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

One can mix default slot and named slots:

```xml
<div>
  <Child>
    default content
    <t t-set-slot="footer">
      content for footer slot here
    </t>
  </Child>
</div>
```

## Default content

Slots can define a default content, in case the parent did not define them:

```xml
<div t-name="Parent">
  <Child/>
</div>

<span t-name="Child">
  <t t-slot="default">default content</t>
</span>
<!-- will be rendered as: <div><span>default content</span></div> -->
```

## Dynamic Slots

The `t-slot` directive is actually able to use any expressions, using string
interplolation:

```xml
 <t t-slot="{{current}}" />
```

This will evaluate the `current` expression, and insert the corresponding slot
at the place of the `t-slot` directive.

## Slots and props

In a sense, slots are almost the same as a prop: they define some information
to pass to the child component. To make it possible to use it, and to pass it
down to sub component, Owl actually define a special prop `slots` that contains
all slot information given to the component. It looks like this:

```js
{ slotName_1: slotInfo_1, ..., slotName_m: slotInfo_m }
```

So, a component can pass its slots to a subcomponent like this:

```xml
<Child slots="props.slots"/>
```

## Slot params

For advanced usecases, it may be necessary to pass additional information to a
slot. This can be done by providing extra key/value pairs to the `t-set-slot`
directive. Then, the generic component can read them in its prop `slots`.

For example, here is how a Notebook component could be implemented (a component
with multiple page, and a tab bar, which only render the current active page,
and each page has a title).

```js
class Notebook extends Component {
  static template = xml`
    <div class="notebook">
      <div class="tabs">
        <t t-foreach="tabNames" t-as="tab" t-key="tab_index">
          <span t-att-class="{active:tab_index === activeTab}" t-on-click="() => state.activeTab=tab_index">
            <t t-esc="props.slots[tab].title"/>
          </span>
        </t>
      </div>
      <div class="page">
        <t t-slot="{{currentSlot}}"/>
      </div>
    </div>`;

  setup() {
    this.state = useState({ activeTab: 0 });
    this.tabNames = Object.keys(this.props.slots);
  }

  get currentSlot() {
    return this.tabNames[this.state.activeTab];
  }
}
```

Notice how one can read the `title` value for each slots. Here is how one could
use this `Notebook` component:

```xml
<Notebook>
  <t t-set-slot="page1" title="'Page 1'">
    <div>this is in the page 1</div>
  </t>
  <t t-set-slot="page2" title="'Page 2'" hidden="somevalue">
    <div>this is in the page 2</div>
  </t>
</Notebook>
```

Slot params works like normal props, so one can use the `.bind` suffix to
bind a function if needed.

## Slot scopes

For other kinds of advanced use cases, the content of a slot may depends on some
information specific to the generic component. This is the opposite of the slot
params.

To solve this kind of problems, one can use the `t-slot-scope` directive along
with the `t-set-slot`. This defines the name of a variable that can access
everything given by the child component:

```xml
<MyComponent>
    <t t-set-slot="foo" t-slot-scope="scope">
        content
        <t t-esc="scope.bool"/>
        <t t-esc="scope.num"/>
    </t>
</MyComponent>
```

And the child component that includes the slot can provide values like this:

```xml
<t t-slot="foo" bool="other_var" num="5">
```

or this:

```xml
<t t-slot="foo" t-props="someObject">
```

In the case of the default slot, you may declare the slot scope directly on the
component itself:

```xml
<MyComponent t-slot-scope="scope">
    content
    <t t-esc="scope.bool"/>
    <t t-esc="scope.num"/>
</MyComponent>
```

Slot values works like normal props, so one can use the `.bind` suffix to
bind a function if needed.
