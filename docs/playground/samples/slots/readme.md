# Generic Components with Slots

Slots are a powerful feature that allows parent components to pass template content to child components. This enables the creation of reusable, generic components.

Slots can feel confusing at first — that's normal! But once you get used to them, they become a natural and powerful way to build reusable components. The key thing to remember: content passed via slots is rendered in the _parent's_ scope. Variables and methods in the slot content refer to the parent component.

## How Slots Work

When a parent uses a component, it can place content between the opening and closing tags:

```xml
<Dialog title="'Hello'" onClose="() => this.toggle(false)">
    <p>some content here</p>
    <Counter />
</Dialog>
```

The child component renders this content using `t-call-slot`:

```xml
<div class="dialog-body">
    <t t-call-slot="default"/>
</div>
```

This pattern lets the parent control parts of the child's template while the child handles structure and styling.

## Multiple Slots

You can define multiple named slots for different insertion points:

```xml
<Card>
    <t t-set-slot="header"><h2>Title</h2></t>
    <t t-set-slot="footer"><button>OK</button></t>
    <p>Main content goes here (default slot)</p>
</Card>
```

The child component renders them by name:

```xml
<header><t t-call-slot="header"/></header>
<main><t t-call-slot="default"/></main>
<footer><t t-call-slot="footer"/></footer>
```
