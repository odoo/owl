const CLICK_COUNTER = `class ClickCounter extends owl.Component {
    constructor() {
        super(...arguments);
        this.state = { value: 0 };
    }

    increment() {
        this.state.value++;
    }
}

const qweb = new owl.QWeb(TEMPLATES);
const counter = new ClickCounter({ qweb });
counter.mount(document.body);
`;

const CLICK_COUNTER_XML = `<templates>
   <button t-name="ClickCounter" t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>
</templates>`;

const CLICK_COUNTER_CSS = `button {
    color: darkred;
    font-size: 30px;
    width: 220px;
}`;

const CLICK_COUNTER_ESNEXT = `// This example will not work if your browser does not support ESNext class fields
class ClickCounter extends owl.Component {
    state = { value: 0 };

    increment() {
        this.state.value++;
    }
}

const qweb = new owl.QWeb(TEMPLATES);
const counter = new ClickCounter({ qweb });
counter.mount(document.body);
`;

const WIDGET_COMPOSITION = `// This example will not work if your browser does not support ESNext class fields

class ClickCounter extends owl.Component {
    state = { value: 0 };

    increment() {
        this.state.value++;
    }
}

class InputWidget extends owl.Component {
    state = {text: ""};
    
    updateVal(event) {
        let value = event.target.value;
        if (this.props.reverse) {
            value = value.split("").reverse().join("");
        }
        this.state.text = value
    }
}

// Main root widget
class App extends owl.Component {
    widgets = {ClickCounter, InputWidget};
}

// Application setup
const qweb = new owl.QWeb(TEMPLATES);
const app = new App({ qweb });
app.mount(document.body);
`;

const WIDGET_COMPOSITION_XML = `<templates>
   <button t-name="ClickCounter" t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>

   <div t-name="InputWidget">
     <input t-on-input="updateVal" placeholder="type here some text..."/>
     <span><t t-esc="state.text"/></span>
    </div>

  <div t-name="App">
      <t t-widget="ClickCounter"/>
      <t t-widget="InputWidget" reverse="true"/>
  </div>
</templates>`;

const WIDGET_COMPOSITION_CSS = `button, input {
    font-size: 20px;
    width: 220px;
    margin: 5px;
}`;

const ANIMATION = `// This example will not work if your browser does not support ESNext class fields
class ClickCounter extends owl.Component {
    state = { value: 0 };

    increment() {
        this.state.value++;
    }
}

class App extends owl.Component {
    state = {flag: false, widgetFlag: false, numbers: []};
    widgets = {ClickCounter};

    toggle() {
        this.state.flag = !this.state.flag;
    }

    toggleWidget() {
        this.state.widgetFlag = !this.state.widgetFlag;
    }

    addNumber() {
        const n = this.state.numbers.length + 1;
        this.state.numbers.push(n);
    }

}

const qweb = new owl.QWeb(TEMPLATES);
const app = new App({qweb});
app.mount(document.body);
`;

const ANIMATION_XML = `<templates>
   <button t-name="ClickCounter" t-on-click="increment" class="clickcounter">
      Click Me! [<t t-esc="state.value"/>]
    </button>

    <div t-name="App">

    <h2>Transition on DOM element</h2>

    <div class="demo">
      <button t-on-click="toggle">Toggle square</button>
      <div>
        <div t-if="state.flag" class="square" t-transition="fade">Hello</div>
      </div>
    </div>

    <h2>Transition on sub widgets</h2>

    <div class="demo">
      <button t-on-click="toggleWidget">
       Toggle widget
      </button>
      <div>
        <t t-widget="ClickCounter" t-if="state.widgetFlag" t-transition="fade"/>
      </div>
    </div>

    <h2>Transition on lists</h2>
    <p>Transitions can also be applied on lists</p>
    <div class="demo">
      <button t-on-click="addNumber">Add a number</button>
      <div>
        <t t-foreach="state.numbers" t-as="n">
          <span t-transition="fade" class="numberspan"><t t-esc="n"/></span>
        </t>
      </div>
    </div>

    <h2>Simple CSS animation</h2>
    <p>Remember, normal CSS still apply: for example, a simple flash animation with pure css </p>
    <div><a class="btn flash">Click</a></div>
  </div>
</templates>
`;

const ANIMATION_CSS = `button {
    font-size: 18px;
    height: 35px;
}
.btn {
    cursor: pointer;
    padding: 5px;
    margin: 5px;
    background-color: #dddddd;
}


.flash {
    background-position: center;
    transition: background 0.5s;
}

.flash:active {
  background-color: gray;
  transition: background 0s;
}


.square {
    background-color: red;
    width: 100px;
    height: 70px;
    color: white;
    margin: 0 20px;
    font-size: 24px;
    line-height: 70px;
    text-align: center;
}

.fade-enter-active, .fade-leave-active {
    transition: opacity .5s;
}
.fade-enter, .fade-leave-to {
    opacity: 0;
}

.demo {
    display: flex;
    height: 80px;
}

.clickcounter {
    margin-left: 20px;
    height: 50px;
    background-color: blue;
    color: white;
}

.numberspan {
    border: 1px solid green;
    margin: 5px;
    padding: 5px;
}
`;


const LIFECYCLE_DEMO = `class HookWidget extends owl.Component {
    constructor() {
        super(...arguments);
        this.state = { n: 0 };
        console.log("constructor");
    }
    async willStart() {
        console.log("willstart");
    }
    mounted() {
        console.log("mounted");
    }
    async willUpdateProps(nextProps) {
        console.log("willUpdateProps", nextProps);
    }
    willPatch() {
        console.log("willPatch");
    }
    patched() {
        console.log("patched");
    }
    willUnmount() {
        console.log("willUnmount");
    }
    increment() {
        this.state.n++;
    }
}

class ParentWidget extends owl.Component {
    constructor() {
        super(...arguments);
        this.widgets = { HookWidget };
        this.state = { n: 0, flag: true };
    }
    increment() {
        this.state.n++;
    }
    toggleSubWidget() {
        this.state.flag = !this.state.flag;
    }
}

const qweb = new owl.QWeb(TEMPLATES);
const widget = new ParentWidget({ qweb });
widget.mount(document.body);
`;

const LIFECYCLE_DEMO_XML = `<templates>
    <div t-name="ParentWidget">
        <button t-on-click="increment">Increment</button>
        <button t-on-click="toggleSubWidget">ToggleSubWidget</button>
        <div t-if="state.flag">
            <t t-widget="HookWidget" n="state.n"/>
        </div>
    </div>
    <div t-name="HookWidget" t-on-click="increment">Demo Sub Widget. Props: <t t-esc="props.n"/>. State: <t t-esc="state.n"/>. (click on me to update me)</div>
</templates>`;

const TODO_APP_STORE = `const ENTER_KEY = 13;
const ESC_KEY = 27;
const LOCALSTORAGE_KEY = "todos-odoo";

//------------------------------------------------------------------------------
// Store Definition
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
            commit("editTodo", {
                id: todo.id,
                completed
            });
        });
    },
    editTodo({ commit }, { id, title }) {
        commit("editTodo", { id, title });
    }
};

const mutations = {
    addTodo({ state }, title) {
        const id = state.nextId++;
        const todo = {
            id,
            title,
            completed: false
        };
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

function makeStore() {
    const todos = JSON.parse(
        window.localStorage.getItem(LOCALSTORAGE_KEY) || "[]"
    );
    const nextId = Math.max(0, ...todos.map(t => t.id || 0)) + 1;
    const state = {
        todos,
        nextId
    };
    const store = new owl.Store({
        state,
        actions,
        mutations
    });
    store.on("update", null, () => {
        const state = JSON.stringify(store.state.todos);
        window.localStorage.setItem(LOCALSTORAGE_KEY, state);
    });
    return store;
}

//------------------------------------------------------------------------------
// TodoItem
//------------------------------------------------------------------------------
class TodoItem extends owl.Component {
    state = { isEditing: false };

    removeTodo() {
        this.env.dispatch("removeTodo", this.props.id);
    }

    toggleTodo() {
        this.env.dispatch("toggleTodo", this.props.id);
    }

    async editTodo() {
        this.state.isEditing = true;
    }

    focusInput() {
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
            this.state.isEditing = false;
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
            this.env.dispatch("editTodo", {
                id: this.props.id,
                title: value
            });
            this.state.isEditing = false;
        }
    }
}

//------------------------------------------------------------------------------
// TodoApp
//------------------------------------------------------------------------------
function mapStoreToProps(state) {
    return {
        todos: state.todos
    };
}

class TodoApp extends owl.Component {
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
        return \` \${items} left\`;
    }

    addTodo(ev) {
        if (ev.keyCode === ENTER_KEY) {
            const title = ev.target.value;
            if (title.trim()) {
                this.env.dispatch("addTodo", title);
            }
            ev.target.value = "";
        }
    }

    clearCompleted() {
        this.env.dispatch("clearCompleted");
    }

    toggleAll() {
        this.env.dispatch("toggleAll", !this.allChecked);
    }

    setFilter(filter) {
        this.state.filter = filter;
    }
}

const ConnectedTodoApp = owl.connect(TodoApp, mapStoreToProps);

//------------------------------------------------------------------------------
// App Initialization
//------------------------------------------------------------------------------
const store = makeStore();
const qweb = new owl.QWeb(TEMPLATES);
const env = {
    qweb,
    store,
    dispatch: store.dispatch.bind(store),
};
const app = new ConnectedTodoApp(env);
app.mount(document.body);
`;

const TODO_APP_STORE_XML = `<templates>
  <section t-name="TodoApp" class="todoapp">
    <header class="header">
      <h1>todos</h1>
      <input class="new-todo" autofocus="true" autocomplete="off" placeholder="What needs to be done?" t-on-keyup="addTodo"/>
    </header>
    <section class="main" t-if="props.todos.length">
      <input class="toggle-all" id="toggle-all" type="checkbox" t-att-checked="allChecked" t-on-click="toggleAll"/>
      <label for="toggle-all"></label>
      <ul class="todo-list">
        <t t-foreach="visibleTodos" t-as="todo">
          <t t-widget="TodoItem" t-key="todo.id" id="todo.id" completed="todo.completed" title="todo.title"/>
        </t>
      </ul>
    </section>
    <footer class="footer" t-if="props.todos.length">
      <span class="todo-count">
        <strong>
            <t t-esc="remaining"/>
        </strong>
        <t t-esc="remainingText"/>
      </span>
      <ul class="filters">
        <li>
          <a t-on-click="setFilter('all')" t-att-class="{selected: state.filter === 'all'}">All</a>
        </li>
        <li>
          <a t-on-click="setFilter('active')" t-att-class="{selected: state.filter === 'active'}">Active</a>
        </li>
        <li>
          <a t-on-click="setFilter('completed')" t-att-class="{selected: state.filter === 'completed'}">Completed</a>
        </li>
      </ul>
      <button class="clear-completed" t-if="props.todos.length gt remaining" t-on-click="clearCompleted">
        Clear completed
      </button>
    </footer>
  </section>

  <li t-name="TodoItem" class="todo" t-att-class="{completed: props.completed, editing: state.isEditing}">
    <div class="view">
      <input class="toggle" type="checkbox" t-on-change="toggleTodo" t-att-checked="props.completed"/>
      <label t-on-dblclick="editTodo">
        <t t-esc="props.title"/>
      </label>
      <button class="destroy" t-on-click="removeTodo"></button>
    </div>
    <input class="edit" t-ref="input" t-if="state.isEditing" t-att-value="props.title" t-on-keyup="handleKeyup" t-mounted="focusInput" t-on-blur="handleBlur"/>
  </li>
</templates>`;

const TODO_APP_STORE_CSS = `html,
body {
  margin: 0;
  padding: 0;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font-size: 100%;
  vertical-align: baseline;
  font-family: inherit;
  font-weight: inherit;
  color: inherit;
  -webkit-appearance: none;
  appearance: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font: 14px "Helvetica Neue", Helvetica, Arial, sans-serif;
  line-height: 1.4em;
  background: #f5f5f5;
  color: #4d4d4d;
  min-width: 230px;
  max-width: 550px;
  margin: 0 auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-weight: 300;
}

:focus {
  outline: 0;
}

.hidden {
  display: none;
}

.todoapp {
  background: #fff;
  margin: 130px 0 40px 0;
  position: relative;
  box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2), 0 25px 50px 0 rgba(0, 0, 0, 0.1);
}

.todoapp input::-webkit-input-placeholder {
  font-style: italic;
  font-weight: 300;
  color: #e6e6e6;
}

.todoapp input::-moz-placeholder {
  font-style: italic;
  font-weight: 300;
  color: #e6e6e6;
}

.todoapp input::input-placeholder {
  font-style: italic;
  font-weight: 300;
  color: #e6e6e6;
}

.todoapp h1 {
  position: absolute;
  top: -155px;
  width: 100%;
  font-size: 100px;
  font-weight: 100;
  text-align: center;
  color: rgba(175, 47, 47, 0.15);
  -webkit-text-rendering: optimizeLegibility;
  -moz-text-rendering: optimizeLegibility;
  text-rendering: optimizeLegibility;
}

.new-todo,
.edit {
  position: relative;
  margin: 0;
  width: 100%;
  font-size: 24px;
  font-family: inherit;
  font-weight: inherit;
  line-height: 1.4em;
  border: 0;
  color: inherit;
  padding: 6px;
  border: 1px solid #999;
  box-shadow: inset 0 -1px 5px 0 rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.new-todo {
  padding: 16px 16px 16px 60px;
  border: none;
  background: rgba(0, 0, 0, 0.003);
  box-shadow: inset 0 -2px 1px rgba(0, 0, 0, 0.03);
}

.main {
  position: relative;
  z-index: 2;
  border-top: 1px solid #e6e6e6;
}

.toggle-all {
  width: 1px;
  height: 1px;
  border: none; /* Mobile Safari */
  opacity: 0;
  position: absolute;
  right: 100%;
  bottom: 100%;
}

.toggle-all + label {
  width: 60px;
  height: 34px;
  font-size: 0;
  position: absolute;
  top: -52px;
  left: -13px;
  -webkit-transform: rotate(90deg);
  transform: rotate(90deg);
}

.toggle-all + label:before {
  content: "❯";
  font-size: 22px;
  color: #e6e6e6;
  padding: 10px 27px 10px 27px;
}

.toggle-all:checked + label:before {
  color: #737373;
}

.todo-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.todo-list li {
  position: relative;
  font-size: 24px;
  border-bottom: 1px solid #ededed;
}

.todo-list li:last-child {
  border-bottom: none;
}

.todo-list li.editing {
  border-bottom: none;
  padding: 0;
}

.todo-list li.editing .edit {
  display: block;
  width: calc(100% - 43px);
  padding: 12px 16px;
  margin: 0 0 0 43px;
}

.todo-list li.editing .view {
  display: none;
}

.todo-list li .toggle {
  text-align: center;
  width: 40px;
  /* auto, since non-WebKit browsers doesn't support input styling */
  height: auto;
  position: absolute;
  top: 0;
  bottom: 0;
  margin: auto 0;
  border: none; /* Mobile Safari */
  -webkit-appearance: none;
  appearance: none;
}

.todo-list li .toggle {
  opacity: 0;
}

.todo-list li .toggle + label {
  /*
		Firefox requires \`#\` to be escaped - https://bugzilla.mozilla.org/show_bug.cgi?id=922433
		IE and Edge requires *everything* to be escaped to render, so we do that instead of just the \`#\` - https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/7157459/
	*/
  background-image: url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%22-10%20-18%20100%20135%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22none%22%20stroke%3D%22%23ededed%22%20stroke-width%3D%223%22/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center left;
}

.todo-list li .toggle:checked + label {
  background-image: url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%22-10%20-18%20100%20135%22%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2250%22%20fill%3D%22none%22%20stroke%3D%22%23bddad5%22%20stroke-width%3D%223%22/%3E%3Cpath%20fill%3D%22%235dc2af%22%20d%3D%22M72%2025L42%2071%2027%2056l-4%204%2020%2020%2034-52z%22/%3E%3C/svg%3E");
}

.todo-list li label {
  word-break: break-all;
  padding: 15px 15px 15px 60px;
  display: block;
  line-height: 1.2;
  transition: color 0.4s;
}

.todo-list li.completed label {
  color: #d9d9d9;
  text-decoration: line-through;
}

.todo-list li .destroy {
  display: none;
  position: absolute;
  top: 0;
  right: 10px;
  bottom: 0;
  width: 40px;
  height: 40px;
  margin: auto 0;
  font-size: 30px;
  color: #cc9a9a;
  margin-bottom: 11px;
  transition: color 0.2s ease-out;
}

.todo-list li .destroy:hover {
  color: #af5b5e;
}

.todo-list li .destroy:after {
  content: "×";
}

.todo-list li:hover .destroy {
  display: block;
}

.todo-list li .edit {
  display: none;
}

.todo-list li.editing:last-child {
  margin-bottom: -1px;
}

.footer {
  color: #777;
  padding: 10px 15px;
  height: 20px;
  text-align: center;
  border-top: 1px solid #e6e6e6;
}

.footer:before {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 50px;
  overflow: hidden;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.2), 0 8px 0 -3px #f6f6f6,
    0 9px 1px -3px rgba(0, 0, 0, 0.2), 0 16px 0 -6px #f6f6f6,
    0 17px 2px -6px rgba(0, 0, 0, 0.2);
}

.todo-count {
  float: left;
  text-align: left;
}

.todo-count strong {
  font-weight: 300;
}

.filters {
  margin: 0;
  padding: 0;
  list-style: none;
  position: absolute;
  right: 0;
  left: 0;
}

.filters li {
  display: inline;
}

.filters li a {
  color: inherit;
  margin: 3px;
  padding: 3px 7px;
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: 3px;
}

.filters li a:hover {
  border-color: rgba(175, 47, 47, 0.1);
}

.filters li a.selected {
  border-color: rgba(175, 47, 47, 0.2);
}

.clear-completed,
html .clear-completed:active {
  float: right;
  position: relative;
  line-height: 20px;
  text-decoration: none;
  cursor: pointer;
}

.clear-completed:hover {
  text-decoration: underline;
}

.info {
  margin: 65px auto 0;
  color: #bfbfbf;
  font-size: 10px;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  text-align: center;
}

.info p {
  line-height: 1;
}

.info a {
  color: inherit;
  text-decoration: none;
  font-weight: 400;
}

.info a:hover {
  text-decoration: underline;
}

/*
	Hack to remove background from Mobile Safari.
	Can't use it globally since it destroys checkboxes in Firefox
*/
@media screen and (-webkit-min-device-pixel-ratio: 0) {
  .toggle-all,
  .todo-list li .toggle {
    background: none;
  }

  .todo-list li .toggle {
    height: 40px;
  }
}

@media (max-width: 430px) {
  .footer {
    height: 50px;
  }

  .filters {
    bottom: 10px;
  }
}

.filters a {
    cursor: pointer;
}
`;

const RESPONSIVE = `class Navbar extends owl.Component {}

class ControlPanel extends owl.Component {
    widgets = { MobileSearchView };
}

class FormView extends owl.Component {
    widgets = { AdvancedWidget };
}

class AdvancedWidget extends owl.Component {}

class Chatter extends owl.Component {}

class MobileSearchView extends owl.Component {}


class App extends owl.Component {
    widgets = { Navbar, ControlPanel, FormView, Chatter };
}

function isMobile() {
    return window.innerWidth <= 768;
}

const env = {
    qweb: new owl.QWeb(TEMPLATES),
    isMobile: isMobile()
};

const app = new App(env);
app.mount(document.body);

function updateEnv() {
    const _isMobile = isMobile();
    if (_isMobile !== env.isMobile) {
        app.updateEnv({
            isMobile: _isMobile
        });
    }
}

window.addEventListener("resize", owl.utils.debounce(updateEnv, 20));
`;

const RESPONSIVE_XML = `<templates>
    <div t-name="Navbar" class="navbar">Navbar</div>

    <div t-name="ControlPanel" class="controlpanel">
        <h2>controlpanel</h2>
        <t t-if="env.isMobile" t-widget="MobileSearchView"/>
    </div>

    <div t-name="FormView" class="formview">
      <h2>formview</h2>
        <t t-if="!env.isMobile" t-widget="AdvancedWidget"/>
    </div>

    <div t-name="Chatter" class="chatter">
      <h2>Chatter</h2>
      <t t-foreach="100" t-as="item"><div>Message <t t-esc="item"/></div></t>
    </div>

    <div t-name="MobileSearchView">MOBILE searchview</div>

    <div t-name="App" class="app" t-att-class="{mobile: env.isMobile, desktop: !env.isMobile}">
        <t t-widget="Navbar"/>
        <t t-widget="ControlPanel"/>
        <div class="content-wrapper" t-if="!env.isMobile">
          <div class="content">
            <t t-widget="FormView"/>
            <t t-widget="Chatter"/>
          </div>
        </div>
        <t t-else="1">
          <t t-widget="FormView"/>
          <t t-widget="Chatter"/>
        </t>

    </div>
    <div t-name="AdvancedWidget">
        This widget is only created in desktop mode.
        <button>Button!</button>
    </div>
</templates>
`;

const RESPONSIVE_CSS = `body {
    margin: 0;
}

.app {
    height: 100%;
    flex-direction: column;
}

.app.desktop {
    display: flex;
}
.navbar {
    flex: 0 0 30px;
    height: 30px;
    background-color: cadetblue;
    color: white;
    line-height: 30px;
}

.controlpanel {
    flex: 0 0 100px;
    height: 100px;
    background-color: #dddddd;
    padding: 8px;
}

.content-wrapper {
    flex: 1 1 auto;
    position: relative;
}

.content {
    display: flex;
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
}

.formview {
    overflow-y: auto;
    flex: 1 1 60%;
    min-height: 200px;
    padding: 8px;
}

.chatter {
    overflow-y: auto;
    flex: 1 1 40%;
    background-color: #eeeeee;
    color: #333333;
    padding: 8px;
}
`;

const EMPTY = `class App extends owl.Component {
}

const qweb = new owl.QWeb(TEMPLATES);
const app = new App({qweb});
app.mount(document.body);
`;

export const SAMPLES = [
  {
    description: "Click Counter",
    code: CLICK_COUNTER,
    xml: CLICK_COUNTER_XML,
    css: CLICK_COUNTER_CSS
  },
  {
    description: "Click Counter (ESNext)",
    code: CLICK_COUNTER_ESNEXT,
    xml: CLICK_COUNTER_XML,
    css: CLICK_COUNTER_CSS
  },
  {
    description: "Widget Composition",
    code: WIDGET_COMPOSITION,
    xml: WIDGET_COMPOSITION_XML,
    css: WIDGET_COMPOSITION_CSS
  },
  {
    description: "Animations",
    code: ANIMATION,
    xml: ANIMATION_XML,
    css: ANIMATION_CSS,
  },
  {
    description: "Lifecycle demo",
    code: LIFECYCLE_DEMO,
    xml: LIFECYCLE_DEMO_XML
  },
  {
    description: "Todo List App (with store)",
    code: TODO_APP_STORE,
    css: TODO_APP_STORE_CSS,
    xml: TODO_APP_STORE_XML
  },
  {
    description: "Responsive app",
    code: RESPONSIVE,
    css: RESPONSIVE_CSS,
    xml: RESPONSIVE_XML
  },
  {
    description: "Empty",
    code: EMPTY
  }
];
