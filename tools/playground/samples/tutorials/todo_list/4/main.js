import { Component, mount, signal, computed } from "@odoo/owl";

class TodoList extends Component {
  static template = "demo.TodoList";

  todos = signal([
    { id: 1, text: "Learn Owl basics", completed: true },
    { id: 2, text: "Build a todo app", completed: false },
    { id: 3, text: "Master reactivity", completed: false },
  ]);

  nextId = 4;
  filter = signal("all");

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
}

mount(TodoList, document.body, { templates: TEMPLATES, dev: true });
