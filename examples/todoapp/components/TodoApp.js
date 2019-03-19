import { TodoItem } from "./TodoItem.js";

const { StoreMixin, Component } = odoo.core;

export class TodoApp extends StoreMixin(Component) {
  template = "todoapp";
  widgets = { TodoItem };
  state = { filter: "all" };

  get todos() {
    return this.env.store.state.todos;
  }

  get allChecked() {
    return this.todos.every(todo => todo.done);
  }

  get remaining() {
    return this.todos.filter(todo => !todo.done).length;
  }

  get remainingText() {
    return (this.remaining < 2 ? "item" : "items") + " left";
  }

  addTodo(ev) {
    if (ev.keyCode === 13) {
      const text = ev.target.value;
      if (text.trim()) {
        this.env.store.dispatch("addTodo", text);
      }
      ev.target.value = "";
    }
  }

  clearCompleted() {
    this.env.store.dispatch("clearCompleted");
  }

  toggleAll() {
    this.env.store.dispatch("toggleAll", !this.allChecked);
  }
}
