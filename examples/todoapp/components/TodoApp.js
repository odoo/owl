import { TodoItem } from "./TodoItem.js";

const { connect, Component } = odoo.core;

const ENTER_KEY = 13;

function mapStateToProps(state) {
  return { todos: state.todos };
}

class TodoApp extends Component {
  template = "todoapp";
  widgets = { TodoItem };
  state = { filter: "all" };

  get visibleTodos() {
    let todos = this.props.todos;
    if (this.state.filter === "active") {
      todos = todos.filter(t => !t.completed);
    }
    if (this.state.filter === "completed") {
      todos = todos.filter(t => t.completed);
    }
    return todos;
  }

  get allChecked() {
    return this.props.todos.every(todo => todo.completed);
  }

  get remaining() {
    return this.props.todos.filter(todo => !todo.completed).length;
  }

  get remainingText() {
    const items = this.remaining < 2 ? "item" : "items";
    return ` ${items} left`;
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

export default connect(mapStateToProps)(TodoApp);
