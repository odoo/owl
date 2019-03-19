export class TodoItem extends odoo.core.Component {
  template = "todoitem";

  removeTodo() {
    this.env.store.dispatch("removeTodo", this.props.id);
  }

  toggleTodo() {
    this.env.store.dispatch("toggleTodo", this.props.id);
  }
}
