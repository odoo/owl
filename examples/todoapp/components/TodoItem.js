const ENTER_KEY = 13;
const ESC_KEY = 27;

export class TodoItem extends owl.core.Component {
  template = "todoitem";

  state = { isEditing: false };

  removeTodo() {
    this.env.store.dispatch("removeTodo", this.props.id);
  }

  toggleTodo() {
    this.env.store.dispatch("toggleTodo", this.props.id);
  }

  async editTodo() {
    await this.updateState({ isEditing: true });
    this.refs.input.value = "";
    this.refs.input.focus();
    this.refs.input.value = this.props.title;
  }

  handleKeyup(ev) {
    if (ev.keyCode === ENTER_KEY) {
      this.updateTitle(ev.target.value);
    }
    if (ev.keyCode === ESC_KEY) {
      ev.target.value = this.props.title;
      this.updateState({ isEditing: false });
    }
  }

  handleBlur(ev) {
    this.updateTitle(ev.target.value);
  }
  updateTitle(title) {
    const value = title.trim();
    if (!value) {
      this.removeTodo(this.props.id);
    } else {
      this.env.store.dispatch("editTodo", {
        id: this.props.id,
        title: value
      });
      this.updateState({ isEditing: false });
    }
  }
}
