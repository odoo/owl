## Styling the Todo List

The todo list works, but it does not look great. In this step, you will add
CSS to make it more presentable, and use `t-att-class` to visually distinguish
completed todos.

Here is what you need to do:

- Remove the "Todo List Tutorial" title
- Add CSS classes on the relevant elements in both templates
- Create a `todo_list.css` and a `todo_item.css` file with styling
- Use `t-att-class` on each todo `<li>` to add a `completed` class when the
  todo is done, and style it with a strikethrough

### Hints

To conditionally add a CSS class, use `t-att-class` with an object:

```xml
<li t-att-class="{ completed: todo.completed }">
```

When `todo.completed` is `true`, the `completed` class is added to the element.

You can combine a static `class` attribute and a dynamic `t-att-class` on the
same element — both will be merged:

```xml
<li class="todo-item" t-att-class="{ completed: todo.completed }">
```

You can then style it in CSS using nested syntax:

```css
.todo-item {
    &.completed span {
        text-decoration: line-through;
        color: #999;
    }
}
```

## Notes

Once you have the strikethrough styling in place, try clicking a checkbox.
You will notice that the text does not toggle between strikethrough and
normal — the UI does not react to the change. Try to understand why: the
`completed` field is a plain boolean, and Owl has no way to know it changed.
Don't worry, we will fix this in a later step by making it reactive.

In Odoo code, you would typically use Bootstrap classes for styling instead
of writing custom CSS.

## Bonus Exercises

- Add a hover effect on todo items.
