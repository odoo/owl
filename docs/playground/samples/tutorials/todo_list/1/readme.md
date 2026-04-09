## Todo List Tutorial

Welcome to the **Todo List** tutorial! In this project you will build a
complete todo application from scratch, step by step. Along the way you will
learn about components, props, events, reactivity, and more.

Use the navigation bar above the editor to move between steps. Each step
includes hints and a solution you can reveal if you get stuck. Let's begin!

---

## Step 1: Rendering a List of Components

In this first step, you will display a list of todos. Each todo will be
rendered by its own `TodoItem` component.

Here is what you need to do:

- Create a `TodoItem` component in a separate file (`todo_item.js`) with its
  template in `todo_item.xml`
- It should accept a `todo` prop (an object with `id`, `text`, `completed`)
  and display the todo text
- Update `TodoList` to import and register `TodoItem`
- Update `todo_list.xml` to iterate over `this.todos` using `t-foreach` and
  render a `TodoItem` for each one
- Each `TodoItem` should display a checkbox that reflects the `completed` status

### Hints

To iterate over a list in a template, use `t-foreach` with a `t-key`:

```xml
<t t-foreach="this.todos" t-as="todo" t-key="todo.id">
  <TodoItem todo="todo"/>
</t>
```

To define and validate props on `TodoItem`, use the `props` helper:

```js
import { Component, props, types as t } from "@odoo/owl";

class TodoItem extends Component {
    props = props({
        todo: t.object({ id: t.number(), text: t.string(), completed: t.boolean() }),
    });
}
```

Note that `props()` without arguments will accept all props blindly. It is
always better to validate the shape and types of expected props.

### File naming and structure

A few good practices to follow as your project grows:

- Each component should live in its own file, using **snake_case**:
  `ProductCard` → `product_card.js`
- The JS, XML, CSS/SCSS files for a component should share the same base name:
  `todo_item.js`, `todo_item.xml`, `todo_item.css`
- Group files **by feature**, not by technology or kind. For example, put
  `todo_item.js`, `todo_item.xml`, `todo_list.js`, `todo_list.xml` together
  in a `todo_list/` folder — not `components/todo_item.js`,
  `templates/todo_item.xml`, `styles/todo_item.css`
- This makes it easy to find everything related to a feature in one place,
  and to move or delete a feature as a whole

## Bonus Exercises

- Try modifying a todo object in the list (e.g. remove the `text` field) and
  observe the props validation error in the console.
- Add a CSS class `completed` on the `<li>` when the todo is completed, using
  `t-att-class`.
