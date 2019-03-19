//------------------------------------------------------------------------------
// ACTIONS
//------------------------------------------------------------------------------

const actions = {
  addTodo({ commit }, text) {
    commit("addTodo", text);
  },
  removeTodo({ commit }, id) {
    commit("removeTodo", id);
  },
  toggleTodo({ state, commit }, id) {
    const todo = state.todos.find(t => t.id === id);
    commit("editTodo", { id, done: !todo.done });
  },
  clearCompleted({ state, commit }) {
    state.todos
      .filter(todo => todo.done)
      .forEach(todo => {
        commit("removeTodo", todo.id);
      });
  },
  toggleAll({ state, commit }, done) {
    state.todos.forEach(todo => {
      commit("editTodo", { id: todo.id, done });
    });
  }
};

//------------------------------------------------------------------------------
// MUTATIONS
//------------------------------------------------------------------------------

const mutations = {
  addTodo(state, text) {
    const id = state.nextId++;
    const todo = { id, text, done: false };
    state.todos.push(todo);
  },
  removeTodo(state, id) {
    const index = state.todos.findIndex(t => t.id === id);
    state.todos.splice(index, 1);
  },
  editTodo(state, { id, text, done }) {
    const todo = state.todos.find(t => t.id === id);
    if (text !== undefined) {
      todo.text = text;
    }
    if (done !== undefined) {
      todo.done = done;
    }
  }
};

class TodoStore extends odoo.core.Store {
  commit(...args) {
    super.commit(...args);
    window.localStorage.setItem("todos", JSON.stringify(this.state.todos));
  }
}
export function makeStore() {
  const todos = JSON.parse(window.localStorage.getItem("todos") || "[]");
  const nextId = Math.max(0, ...todos.map(t => t.id || 0)) + 1;
  const state = { todos, nextId };
  return new TodoStore({ state, actions, mutations });
}
