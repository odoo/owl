//------------------------------------------------------------------------------
// ACTIONS
//------------------------------------------------------------------------------

const actions = {
  addTodo({ commit }, title) {
    commit("addTodo", title);
  },
  removeTodo({ commit }, id) {
    commit("removeTodo", id);
  },
  toggleTodo({ state, commit }, id) {
    const todo = state.todos.find(t => t.id === id);
    commit("editTodo", { id, completed: !todo.completed });
  },
  clearCompleted({ state, commit }) {
    state.todos
      .filter(todo => todo.completed)
      .forEach(todo => {
        commit("removeTodo", todo.id);
      });
  },
  toggleAll({ state, commit }, completed) {
    state.todos.forEach(todo => {
      commit("editTodo", { id: todo.id, completed });
    });
  },
  editTodo({ commit }, { id, title }) {
    commit("editTodo", { id, title });
  }
};

//------------------------------------------------------------------------------
// MUTATIONS
//------------------------------------------------------------------------------

const mutations = {
  addTodo({ state }, title) {
    const id = state.nextId++;
    const todo = { id, title, completed: false };
    state.todos.push(todo);
  },
  removeTodo({ state }, id) {
    const index = state.todos.findIndex(t => t.id === id);
    state.todos.splice(index, 1);
  },
  editTodo({ state }, { id, title, completed }) {
    const todo = state.todos.find(t => t.id === id);
    if (title !== undefined) {
      todo.title = title;
    }
    if (completed !== undefined) {
      todo.completed = completed;
    }
  }
};

//------------------------------------------------------------------------------
// STORE
//------------------------------------------------------------------------------
const LOCALSTORAGE_KEY = "todos-odoo";

export function makeStore() {
  const todos = JSON.parse(
    window.localStorage.getItem(LOCALSTORAGE_KEY) || "[]"
  );
  const nextId = Math.max(0, ...todos.map(t => t.id || 0)) + 1;
  const state = { todos, nextId };
  const store = new owl.extras.Store({ state, actions, mutations });
  store.on("update", null, () => {
    const state = JSON.stringify(store.state.todos);
    window.localStorage.setItem(LOCALSTORAGE_KEY, state);
  });
  return store;
}
