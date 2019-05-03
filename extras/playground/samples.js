const CLICK_COUNTER = `class ClickCounter extends owl.Component {
    constructor() {
        super(...arguments);
        this.template = "clickcounter";
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
   <button t-name="clickcounter" t-on-click="increment">
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
    template = "clickcounter";
    state = { value: 0 };

    increment() {
        this.state.value++;
    }
}

const qweb = new owl.QWeb(TEMPLATES);
const counter = new ClickCounter({ qweb });
counter.mount(document.body);
`;

const WIDGET_COMPOSITION = `class ClickCounter extends owl.Component {
    constructor(parent, props) {
        super(parent, props);
        this.template = "clickcounter";
        this.state = { value: props.initialState || 0 };
    }

    increment() {
        this.state.value++;
    }
}

let nextId = 1;

class App extends owl.Component {
    constructor() {
        super(...arguments);
        this.template = "app";
        this.state = { counters: [] }
        this.widgets = { ClickCounter };
    }

    addCounter() {
        this.state.counters.push(nextId++);
    }
}

const qweb = new owl.QWeb(TEMPLATES);
const app = new App({ qweb });
app.mount(document.body);
`;

const WIDGET_COMPOSITION_XML = `<templates>
   <button t-name="clickcounter" t-on-click="increment">
      Click Me! [<t t-esc="state.value"/>]
    </button>

  <div t-name="app">
      <div><button t-on-click="addCounter">Add a counter</button></div>
      <div>
        <t t-foreach="state.counters" t-as="counter">
          <t t-widget="ClickCounter" t-key="counter" t-props="{initialState: counter}"/>
        </t>
      </div>
  </div>
</templates>`;

const WIDGET_COMPOSITION_CSS = `button {
    color: darkred;
    font-size: 30px;
    width: 220px;
}`;

const ANIMATION = `// This example will not work if your browser does not support ESNext class fields
class App extends owl.Component {
    template = "app";
    state = {flag: 0};

    toggle() {
        this.state.flag = !this.state.flag;
    }
}

const qweb = new owl.QWeb(TEMPLATES);
const app = new App({qweb});
app.mount(document.body);
`;

const ANIMATION_XML = `<templates>
  <div t-name="app">
    <button t-on-click="toggle">
      Click Me!
    </button>
    <div>
      <div t-if="state.flag" class="square" t-transition="fade">Hello</div>
    </div>
  </div>
</templates>
`;

const ANIMATION_CSS = `button {
    width: 100px;
    height: 30px;
    font-size: 20px;
}

.square {
    background-color: red;
    width: 100px;
    height: 100px;
    color: white;
    margin: 20px;
    font-size: 24px;
    line-height: 100px;
    text-align: center;
    line-height: 100px;
}

.fade-enter-active, .fade-leave-active {
    transition: opacity .5s;
}
.fade-enter, .fade-leave-to {
    opacity: 0;
}
`;


const LIFECYCLE_DEMO = `class HookWidget extends owl.Component {
    constructor() {
        super(...arguments);
        this.template = "demo.hookwidget";
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
        this.template = "demo.parentwidget";
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
    <div t-name="demo.parentwidget">
        <button t-on-click="increment">Increment</button>
        <button t-on-click="toggleSubWidget">ToggleSubWidget</button>
        <div t-if="state.flag">
            <t t-widget="HookWidget" t-props="{n:state.n}"/>
        </div>
    </div> 
    <div t-name="demo.hookwidget" t-on-click="increment">Demo Sub Widget. Props: <t t-esc="props.n"/>. State: <t t-esc="state.n"/>. (click on me to update me)</div>
</templates>`;

const BENCHMARK_APP = `//------------------------------------------------------------------------------
// Generating demo data
//------------------------------------------------------------------------------
const messages = [];
const authors = ["Aaron", "David", "Vincent"];
const content = [
    "Lorem ipsum dolor sit amet",
    "Sed ut perspiciatis unde omnis iste natus error sit voluptatem",
    "Excepteur sint occaecat cupidatat non proident"
];

function chooseRandomly(array) {
    const index = Math.floor(Math.random() * array.length);
    return array[index];
}

for (let i = 1; i < 16000; i++) {
    messages.push({
        id: i,
        author: chooseRandomly(authors),
        msg: \`\${i}: \${chooseRandomly(content)}\`,
        likes: 0
    });
}

//------------------------------------------------------------------------------
// Counter Widget
//------------------------------------------------------------------------------
class Counter extends owl.Component {
    constructor(parent, props) {
        super(parent, props);
        this.template = "counter";
        this.state = { counter: props.initialState || 0 };
    }

    increment(delta) {
        this.state.counter += delta;
    }
}

//------------------------------------------------------------------------------
// Message Widget
//------------------------------------------------------------------------------
class Message extends owl.Component {
    constructor() {
        super(...arguments);
        this.template = "message";
        this.widgets = { Counter };
    }

    removeMessage() {
        this.trigger("remove_message", {
            id: this.props.id
        });
    }
}

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------
class App extends owl.Component {
    constructor() {
        super(...arguments);
        this.template = "root";
        this.widgets = { Message };
        this.state = { messages: messages.slice(0, 10) };
    }

    setMessageCount(n) {
        this.state.messages = messages.slice(0, n);
    }

    removeMessage(data) {
        const index = messages.findIndex(m => m.id === data.id);
        this.state.messages.splice(index, 1);
    }

    increment(delta) {
        const n = this.state.messages.length + delta;
        this.setMessageCount(n);
    }
}

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------
const env = {
    qweb: new owl.QWeb(TEMPLATES)
};

const app = new App(env);
app.mount(document.body);
`;

const BENCHMARK_APP_CSS = `.main {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;

  display: grid;
  grid-template-columns: 220px 1fr;
}

.left-thing {
  background-color: gray;
  padding: 20px;
}

.left-thing button {
  width: 100%;
}

.left-thing .counter span {
  color: white;
}

.left-thing .counter button {
  width: 40px;
}

.right-thing {
  padding: 20px;
  overflow: auto;
}

/* Message widget */
.message .author {
  font-weight: bold;
}

.message {
  width: 400px;
  background-color: lightblue;
  margin: 10px 5px;
  border-radius: 5px;
  padding: 5px;
}`;

const BENCHMARK_APP_XML = `<templates>
  <div t-name="root" class="main">
      <div class="left-thing">
          <div class="counter">
              <button t-on-click="increment(-1)">-</button>
              <span style="font-weight:bold">Value: <t t-esc="state.messages.length"/></span>
              <button t-on-click="increment(1)">+</button>
          </div>
          <button t-on-click="setMessageCount(10)">10 messages</button>
          <button t-on-click="setMessageCount(20)">20 messages</button>
          <button t-on-click="setMessageCount(500)">500 messages</button>
          <button t-on-click="setMessageCount(1000)">1000 messages</button>
          <button t-on-click="setMessageCount(5000)">5000 messages</button>
          <button t-on-click="setMessageCount(15000)">15000 messages</button>
      </div>
      <div class="right-thing">
          <div class="content">
              <t t-foreach="state.messages" t-as="message">
                  <t t-widget="Message" t-att-key="message.id" t-props="message" t-on-remove_message="removeMessage"/>
              </t>
          </div>
      </div>
  </div>

  <div t-name="message" class="message">
    <span class="author"><t t-esc="props.author"/></span>
    <span class="msg"><t t-esc="props.msg"/></span>
    <button class="remove" t-on-click="removeMessage">Remove</button>
    <t t-widget="Counter" t-props="{initialState: props.id}"/>
  </div>

  <div t-name="counter">
    <button t-on-click="increment(-1)">-</button>
    <span style="font-weight:bold">Value: <t t-esc="state.counter"/></span>
    <button t-on-click="increment(1)">+</button>
  </div>

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
    template = "todoitem";
    state = { isEditing: false };

    removeTodo() {
        this.env.store.dispatch("removeTodo", this.props.id);
    }

    toggleTodo() {
        this.env.store.dispatch("toggleTodo", this.props.id);
    }

    async editTodo() {
        this.state.isEditing = true;
        setTimeout(() => {
            this.refs.input.value = "";
            this.refs.input.focus();
            this.refs.input.value = this.props.title;
        });
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
            this.env.store.dispatch("editTodo", {
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
function mapStateToProps(state) {
    return {
        todos: state.todos
    };
}

class TodoApp extends owl.Component {
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
        return \` \${items} left\`;
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

    setFilter(filter) {
        this.state.filter = filter;
    }
}

const ConnectedTodoApp = owl.connect(mapStateToProps)(TodoApp);

//------------------------------------------------------------------------------
// App Initialization
//------------------------------------------------------------------------------
const store = makeStore();
const qweb = new owl.QWeb(TEMPLATES);
const env = {
    qweb,
    store
};
const app = new ConnectedTodoApp(env);
app.mount(document.body);
`;

const TODO_APP_STORE_XML = `<templates>
  <section t-name="todoapp" class="todoapp">
    <header class="header">
      <h1>todos</h1>
      <input class="new-todo" autofocus="true" autocomplete="off" placeholder="What needs to be done?" t-on-keyup="addTodo"/>
    </header>
    <section class="main" t-if="props.todos.length">
      <input class="toggle-all" id="toggle-all" type="checkbox" t-att-checked="allChecked" t-on-click="toggleAll"/>
      <label for="toggle-all"></label>
      <ul class="todo-list">
        <t t-foreach="visibleTodos" t-as="todo">
          <t t-widget="TodoItem" t-key="todo.id" t-props="todo"/>
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

  <li t-name="todoitem" class="todo" t-att-class="{completed: props.completed, editing: state.isEditing}">
    <div class="view">
      <input class="toggle" type="checkbox" t-on-change="toggleTodo" t-att-checked="props.completed"/>
      <label t-on-dblclick="editTodo">
        <t t-esc="props.title"/>
      </label>
      <button class="destroy" t-on-click="removeTodo"></button>
    </div>
    <input class="edit" t-ref="'input'" t-if="state.isEditing" t-att-value="props.title" t-on-keyup="handleKeyup" t-on-blur="handleBlur"/>
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

const RESPONSIVE = `class SubWidget extends owl.Component {
    constructor() {
        super(...arguments);
        this.template = "subwidget";
    }
}

class ResponsiveWidget extends owl.Component {
    constructor() {
        super(...arguments);
        this.template = "responsivewidget";
        this.widgets = { SubWidget };
    }
}

function isMobile() {
    return window.innerWidth <= 768;
}

const env = {
    qweb: new owl.QWeb(TEMPLATES),
    isMobile: isMobile()
};

const widget = new ResponsiveWidget(env);
widget.mount(document.body);

window.addEventListener(
    "resize",
    owl.utils.debounce(function() {
        const _isMobile = isMobile();
        if (_isMobile !== env.isMobile) {
            widget.updateEnv({
                isMobile: _isMobile
            });
        }
    }, 20)
);
`;

const RESPONSIVE_XML = `<templates>
    <div t-name="responsivewidget">
        <div class="info">
            <span class="mobile" t-if="env.isMobile">Mobile</span>
            <span class="desktop" t-else="1">Desktop</span>
            mode
        </div>
        <t t-widget="SubWidget" t-if="!env.isMobile"/>
    </div>
    <div t-name="subwidget" class="subwidget">
        This widget is only instantiated in desktop mode.  It will be destroyed
        and recreated if the mode changes from destop to mobile, and back to desktop
    </div>
</templates>
`;

const RESPONSIVE_CSS = `.info {
    font-size: 30px;
}
.desktop {
    color: green;
}
.mobile {
    color: blue;
}
.subwidget {
    margin: 30px;
}`;

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
    description: "Benchmark application",
    code: BENCHMARK_APP,
    css: BENCHMARK_APP_CSS,
    xml: BENCHMARK_APP_XML
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
