import { TodoItem } from "./TodoItem.js";

const { StoreMixin, Component } = odoo.core;

const ENTER_KEY = 13;

export class TodoApp extends StoreMixin(Component) {
  template = "todoapp";
  widgets = { TodoItem };
  state = { filter: "all" };

  get todos() {
    return this.env.store.state.todos;
  }

  get visibleTodos() {
    let todos = this.todos;
    if (this.state.filter === "active") {
      todos = todos.filter(t => !t.completed);
    }
    if (this.state.filter === "completed") {
      todos = todos.filter(t => t.completed);
    }
    return todos;
  }

  get allChecked() {
    return this.todos.every(todo => todo.completed);
  }

  get remaining() {
    return this.todos.filter(todo => !todo.completed).length;
  }

  get remainingText() {
    return (this.remaining < 2 ? "item" : "items") + " left";
  }

  addTodo(ev) {
    if (ev.keyCode === ENTER_KEY) {
      const title = ev.target.value;
      if (title.trim()) {
        this.env.store.dispatch("addTodo", title);
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
