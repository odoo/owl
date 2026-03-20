import {
  Component,
  computed,
  effect,
  mount,
  plugin,
  Plugin,
  PluginManager,
  signal,
  useEffect,
  onWillDestroy,
} from "@odoo/owl";

const ENTER_KEY = 13;
const ESC_KEY = 27;

class TodoItem {
  #list;

  constructor(list, { id, text, completed }) {
    this.#list = list;
    this.id = id;
    this.text = signal(text);
    this.completed = signal(completed);
  }

  delete() {
    this.#list.delete(this);
  }

  toggle() {
    this.completed.update((v) => !v);
  }
}

class LocalStoragePlugin extends Plugin {
  static id = "local_storage";

  cleanups = [];

  setup() {
    onWillDestroy(() => {
      for (let cleanup of this.cleanups) {
        cleanup();
      }
    });
  }

  open({ key, encode, decode }) {
    const str = localStorage.getItem(key);
    const result = signal(decode(str));
    this.cleanups.push(
      effect(() => {
        const str = encode(result());
        localStorage.setItem(key, str);
      })
    );
    return result;
  }
}

class TodoListPlugin extends Plugin {
  static id = "todo_list";

  localStorage = plugin(LocalStoragePlugin);

  todos = this.localStorage.open({
    key: "todoapp",
    encode: (data) => {
      const json = data.map((todo) => ({
        id: todo.id,
        text: todo.text(),
        completed: todo.completed(),
      }));
      return JSON.stringify(json);
    },
    decode: (str) => {
      const data = JSON.parse(str || "[]");
      return data.map((todo) => new TodoItem(this, todo));
    },
  });

  generateId() {
    return Math.random().toString(36).substring(2, 10);
  }

  isEmpty = computed(() => !this.todos().length);

  add(text) {
    text = text.trim();
    if (text) {
      const todo = new TodoItem(this, {
        id: this.generateId(),
        text,
        completed: false,
      });
      this.todos().push(todo);
      this.todos.update();
    }
  }

  delete(todo) {
    const result = this.todos().filter((t) => t !== todo);
    this.todos.set(result);
  }

  toggleAll(value) {
    for (let todo of this.todos()) {
      todo.completed.set(value);
    }
  }

  clearCompleted() {
    const completed = this.todos().filter((t) => t.completed());
    for (let todo of completed) {
      this.delete(todo);
    }
  }
}

class Todo extends Component {
  static template = "demo.Todo";

  props = { todo: TodoItem };
  todo = this.props.todo;
  isEditing = signal(false);
  input = signal(null);
  editText = signal(this.todo.text());

  setup() {
    useEffect(
      (el) => el?.focus(),
      () => [this.input()]
    );
  }

  startEditing() {
    this.isEditing.set(true);
    this.editText.set(this.todo.text());
  }

  handleKeyup(ev) {
    if (ev.keyCode === ENTER_KEY) {
      this.saveEdit();
    }
    if (ev.keyCode === ESC_KEY) {
      this.cancelEdit();
    }
  }

  saveEdit() {
    const text = this.editText().trim();
    if (text) {
      this.todo.text.set(text);
    }
    this.isEditing.set(false);
  }

  cancelEdit() {
    this.editText.set(this.todo.text());
    this.isEditing.set(false);
  }
}

class TodoList extends Component {
  static template = "demo.TodoList";
  static components = { Todo };

  todoList = plugin(TodoListPlugin);
  filter = signal("all");

  visibleTodos = computed(() => {
    const todos = this.todoList.todos();
    switch (this.filter()) {
      case "active":
        return todos.filter((t) => !t.completed());
      case "completed":
        return todos.filter((t) => t.completed());
      default:
        return todos;
    }
  });

  remaining = computed(() => {
    return this.todoList.todos().filter((todo) => !todo.completed()).length;
  });

  allChecked = computed(() => this.remaining() === 0);

  addTodo(ev) {
    if (ev.keyCode === ENTER_KEY) {
      const text = ev.target.value;
      if (text.trim()) {
        this.todoList.add(text);
      }
      ev.target.value = "";
    }
  }

  setFilter(filter) {
    this.filter.set(filter);
  }
}

const pluginManager = new PluginManager();
pluginManager.startPlugins([TodoListPlugin]);

mount(TodoList, document.body, { templates: TEMPLATES, pluginManager, dev: true });
