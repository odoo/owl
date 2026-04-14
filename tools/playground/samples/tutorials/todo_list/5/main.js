import { Component, mount, signal, computed, useEffect } from "@odoo/owl";

class TodoList extends Component {
  static template = "demo.TodoList";

  todos = signal([
    { id: 1, text: "Learn Owl basics", completed: true },
    { id: 2, text: "Build a todo app", completed: false },
    { id: 3, text: "Master reactivity", completed: false },
  ]);

  nextId = 4;
  filter = signal("all");
  editingId = signal(null);
  editText = signal("");
  editInput = signal(null);

  setup() {
    useEffect(
      (el) => el?.focus(),
      () => [this.editInput()]
    );
  }

  filteredTodos = computed(() => {
    const todos = this.todos();
    switch (this.filter()) {
      case "active":
        return todos.filter((t) => !t.completed);
      case "completed":
        return todos.filter((t) => t.completed);
      default:
        return todos;
    }
  });

  remaining = computed(() => this.todos().filter((t) => !t.completed).length);

  addTodo(ev) {
    if (ev.key === "Enter") {
      const text = ev.target.value.trim();
      if (text) {
        this.todos.update((todos) => [...todos, { id: this.nextId++, text, completed: false }]);
        ev.target.value = "";
      }
    }
  }

  toggleTodo(todo) {
    todo.completed = !todo.completed;
    this.todos.update((todos) => [...todos]);
  }

  deleteTodo(todo) {
    this.todos.update((todos) => todos.filter((t) => t !== todo));
  }

  setFilter(filter) {
    this.filter.set(filter);
  }

  startEditing(todo) {
    this.editingId.set(todo.id);
    this.editText.set(todo.text);
  }

  handleEditKeyup(todo, ev) {
    if (ev.key === "Enter") {
      const text = this.editText().trim();
      if (text) {
        todo.text = text;
        this.todos.update((todos) => [...todos]);
      }
      this.editingId.set(null);
    } else if (ev.key === "Escape") {
      this.editingId.set(null);
    }
  }

  handleBlur() {
    this.editingId.set(null);
  }
}

mount(TodoList, document.body, { templates: TEMPLATES, dev: true });
