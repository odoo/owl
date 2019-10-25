const COMPONENTS = `// In this example, we show how components can be defined and created.
const { Component, useState } = owl;

class Greeter extends Component {
    state = useState({ word: 'Hello' });

    toggle() {
        this.state.word = this.state.word === 'Hi' ? 'Hello' : 'Hi';
    }
}

// Main root component
class App extends Component {
    state = useState({ name: 'World'});
}
App.components = { Greeter };

// Application setup
// Note that the xml templates are injected into the global TEMPLATES variable.
const qweb = new owl.QWeb({ templates: TEMPLATES});
const app = new App({ qweb });
app.mount(document.body);
`;

const COMPONENTS_XML = `<templates>
  <div t-name="Greeter" class="greeter" t-on-click="toggle">
    <t t-esc="state.word"/>, <t t-esc="props.name"/>
  </div>

  <div t-name="App">
    <Greeter name="state.name"/>
  </div>
</templates>
`;

const COMPONENTS_CSS = `.greeter {
    font-size: 20px;
    width: 300px;
    height: 100px;
    margin: 5px;
    text-align: center;
    line-height: 100px;
    background-color: #eeeeee;
    user-select: none;
}`;

const ANIMATION = `// The goal of this component is to see how the t-transition directive can be
// used to generate simple transition effects.
const { Component, useState } = owl;

class Counter extends Component {
    state = useState({ value: 0 });

    increment() {
        this.state.value++;
    }
}

class App extends Component {
    state = useState({ flag: false, componentFlag: false, numbers: [] });

    toggle(key) {
        this.state[key] = !this.state[key];
    }

    addNumber() {
        const n = this.state.numbers.length + 1;
        this.state.numbers.push(n);
    }
}
App.components = { Counter };

const qweb = new owl.QWeb({ templates: TEMPLATES});
const app = new App({qweb});
app.mount(document.body);
`;

const ANIMATION_XML = `<templates>
   <button t-name="Counter" t-on-click="increment" class="clickcounter">
      Click Me! [<t t-esc="state.value"/>]
    </button>

    <div t-name="App">
      <h2>Transition on DOM element</h2>

      <div class="demo">
        <button t-on-click="toggle('flag')">Toggle square</button>
        <div>
          <div t-if="state.flag" class="square" t-transition="fade">Hello</div>
        </div>
      </div>

      <h2>Transition on sub components</h2>

      <div class="demo">
        <button t-on-click="toggle('componentFlag')">Toggle component</button>
        <div>
          <Counter t-if="state.componentFlag" t-transition="fade"/>
        </div>
      </div>

      <h2>Transition on lists</h2>
      <p>Transitions can also be applied on lists</p>
      <div class="demo">
        <button t-on-click="addNumber">Add a number</button>
        <div>
          <t t-foreach="state.numbers" t-as="n">
            <span t-transition="fade" class="numberspan" t-key="n"><t t-esc="n"/></span>
          </t>
        </div>
      </div>

      <h2>Simple CSS animation</h2>
      <p>Remember, normal CSS still apply: for example, a simple flash animation with pure css </p>
      <div><a class="btn flash">Click</a>
    </div>
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
    transition: background .6s;
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
    transition: opacity .6s;
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

const LIFECYCLE_DEMO = `// This example shows all the possible lifecycle hooks
//
// The root component controls a sub component (DemoComponent). It logs all its lifecycle
// methods in the console.  Try modifying its state by clicking on it, or by
// clicking on the two main buttons, and look into the console to see what
// happens.
const { Component, useState } = owl;

class DemoComponent extends Component {
    constructor() {
        super(...arguments);
        this.state = useState({ n: 0 });
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

class App extends Component {
    state = useState({ n: 0, flag: true });

    increment() {
        this.state.n++;
    }

    toggleSubComponent() {
        this.state.flag = !this.state.flag;
    }
}
App.components = { DemoComponent };

const qweb = new owl.QWeb({ templates: TEMPLATES});
const app = new App({ qweb });
app.mount(document.body);
`;

const LIFECYCLE_DEMO_XML = `<templates>
  <div t-name="DemoComponent" t-on-click="increment" class="demo">
    <div>Demo Sub Component</div>
    <div>(click on me to update me)</div>
    <div>Props: <t t-esc="props.n"/>, State: <t t-esc="state.n"/>. </div>
  </div>

  <div t-name="App">
    <button t-on-click="increment">Increment Parent State</button>
    <button t-on-click="toggleSubComponent">Toggle SubComponent</button>
    <div t-if="state.flag">
      <DemoComponent n="state.n"/>
    </div>
  </div>
</templates>`;

const LIFECYCLE_CSS = `button {
    font-size: 18px;
    margin: 5px;
}

.demo {
    margin: 10px;
    padding: 10px;
    background-color: #dddddd;
    width: 250px;
}`;

const HOOKS_DEMO = `// In this example, we show how hooks can be used or defined.
const {useState, onMounted, onWillUnmount} = owl.hooks;

// We define here a custom behaviour: this hook tracks the state of the mouse
// position
function useMouse() {
    const position = useState({x:0, y: 0});

    function update(e) {
        position.x = e.clientX;
        position.y = e.clientY;
    }
    onMounted(() => {
        window.addEventListener('mousemove', update);
    });
    onWillUnmount(() => {
        window.removeEventListener('mousemove', update);
    });

    return position;
}


// Main root component
class App extends owl.Component {
    // simple state hook (reactive object)
    counter = useState({ value: 0 });

    // this hooks is bound to the 'mouse' property.
    mouse = useMouse();

    increment() {
        this.counter.value++;
    }
}

// Application setup
const qweb = new owl.QWeb({ templates: TEMPLATES});
const app = new App({ qweb });
app.mount(document.body);
`;

const HOOKS_DEMO_XML = `<templates>
  <div t-name="App">
    <button t-on-click="increment">Click! <t t-esc="counter.value"/></button>
    <div>Mouse: <t t-esc="mouse.x"/>, <t t-esc="mouse.y"/></div>
  </div>
</templates>
`;

const HOOKS_CSS = `button {
    width: 120px;
    height: 35px;
    font-size: 16px;
}`;

const CONTEXT_JS = `// In this example, we show how components can use the Context and 'useContext'
// hook to share information between them.
const { Component, Context } = owl;
const { useContext } = owl.hooks;

class ToolbarButton extends Component {
    theme = useContext(this.env.themeContext);

    get style () {
        const theme = this.theme;
        return \`background-color: \${theme.background}; color: \${theme.foreground}\`;
    }
}

class Toolbar extends Component {}
Toolbar.components = { ToolbarButton };

// Main root component
class App extends Component {
    toggleTheme() {
        const { background, foreground } = this.env.themeContext.state;
        this.env.themeContext.state.background = foreground;
        this.env.themeContext.state.foreground = background;
    }
}
App.components = { Toolbar };

// Application setup
const themeContext = new Context({
   background: '#000',
   foreground: '#fff',
});
const env = {
    qweb: new owl.QWeb({ templates: TEMPLATES}),
    themeContext: themeContext,
};
const app = new App(env);
app.mount(document.body);
`;

const CONTEXT_XML = `<templates>
  <button t-name="ToolbarButton" t-att-style="style">
    <t t-esc="props.name"/>
  </button>

  <div t-name="Toolbar">
    <ToolbarButton name="'A'"/>
    <ToolbarButton name="'B'"/>
    <ToolbarButton name="'C'"/>
  </div>

  <div t-name="App">
    <button t-on-click="toggleTheme">Toggle Mode</button>
    <Toolbar/>
  </div>
</templates>
`;

const TODO_APP_STORE = `// This example is an implementation of the TodoList application, from the
// www.todomvc.com project.  This is a non trivial application with some
// interesting user interactions. It uses the local storage for persistence.
//
// In this implementation, we use the owl Store class to manage the state.  It
// is very similar to the VueX store.
const { Component, useState } = owl;
const { useRef, useStore, useDispatch, onPatched, onMounted } = owl.hooks;

//------------------------------------------------------------------------------
// Constants, helpers
//------------------------------------------------------------------------------
const ENTER_KEY = 13;
const ESC_KEY = 27;
const LOCALSTORAGE_KEY = "todomvc";

function useAutofocus(name) {
  let ref = useRef(name);
  let isInDom = false;
  function updateFocus() {
    if (!isInDom && ref.el) {
      isInDom = true;
      const current = ref.el.value;
      ref.el.value = "";
      ref.el.focus();
      ref.el.value = current;
    } else if (isInDom && !ref.el) {
      isInDom = false;
    }
  }
  onPatched(updateFocus);
  onMounted(updateFocus);
}

//------------------------------------------------------------------------------
// Store
//------------------------------------------------------------------------------
const initialState = { todos: [], nextId: 1};

const actions = {
    addTodo({ state }, title) {
        const todo = {
            id: state.nextId++,
            title,
            completed: false
        }
        state.todos.push(todo);
    },
    removeTodo({ state }, id) {
        const index = state.todos.findIndex(t => t.id === id);
        state.todos.splice(index, 1);
    },
    updateTodo({state, dispatch}, {id, title}) {
        const value = title.trim();
        if (!value) {
            dispatch('removeTodo', id);
        } else {
            const todo = state.todos.find(t => t.id === id);
            todo.title = value;
        }
    },
    toggleTodo({ state }, id) {
        const todo = state.todos.find(t => t.id === id);
        todo.completed = !todo.completed;
    },
    clearCompleted({ state, dispatch }) {
        for (let todo of state.todos) {
            if (todo.completed) {
                dispatch("removeTodo", todo.id);
            }
        }
    },
    toggleAll({ state, dispatch }, completed) {
        for (let todo of state.todos) {
            todo.completed = completed;
        }
    },
};

//------------------------------------------------------------------------------
// TodoItem
//------------------------------------------------------------------------------
class TodoItem extends Component {
    state = useState({ isEditing: false });
    dispatch = useDispatch();

    constructor(...args) {
        super(...args);
        useAutofocus("input");
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
        this.dispatch("updateTodo", {title, id: this.props.id});
        this.state.isEditing = false;
    }
}

//------------------------------------------------------------------------------
// TodoApp
//------------------------------------------------------------------------------
class TodoApp extends Component {
    state = useState({ filter: "all" });
    todos = useStore(state => state.todos);
    dispatch = useDispatch();

    get visibleTodos() {
        switch (this.state.filter) {
            case "active": return this.todos.filter(t => !t.completed);
            case "completed": return this.todos.filter(t => t.completed);
            case "all": return this.todos;
        }
    }

    get allChecked() {
        return this.todos.every(todo => todo.completed);
    }

    get remaining() {
        return this.todos.filter(todo => !todo.completed).length;
    }

    get remainingText() {
        const items = this.remaining < 2 ? "item" : "items";
        return \` \${items} left\`;
    }

    addTodo(ev) {
        if (ev.keyCode === ENTER_KEY) {
            const title = ev.target.value;
            if (title.trim()) {
                this.dispatch("addTodo", title);
            }
            ev.target.value = "";
        }
    }

    setFilter(filter) {
        this.state.filter = filter;
    }
}
TodoApp.components = { TodoItem };

//------------------------------------------------------------------------------
// App Initialization
//------------------------------------------------------------------------------
function saveState(state) {
    const str = JSON.stringify(state);
    window.localStorage.setItem(LOCALSTORAGE_KEY, str);
}

function loadState() {
    const localState = window.localStorage.getItem(LOCALSTORAGE_KEY);
    return localState ? JSON.parse(localState) : initialState;
}

function makeEnv() {
    const state = loadState();
    const store = new owl.Store({ state, actions });
    store.on("update", null, () => saveState(store.state));
    const qweb = new owl.QWeb({ templates: TEMPLATES});
    return { qweb, store };
}

const env = makeEnv();
const app = new TodoApp(env);
app.mount(document.body);
`;

const TODO_APP_STORE_XML = `<templates>
  <section t-name="TodoApp" class="todoapp">
    <header class="header">
      <h1>todos</h1>
      <input class="new-todo" autofocus="true" autocomplete="off" placeholder="What needs to be done?" t-on-keyup="addTodo"/>
    </header>
    <section class="main" t-if="todos.length">
      <input class="toggle-all" id="toggle-all" type="checkbox" t-att-checked="allChecked" t-on-click="dispatch('toggleAll', !allChecked)"/>
      <label for="toggle-all"></label>
      <ul class="todo-list">
        <t t-foreach="visibleTodos" t-as="todo">
          <TodoItem t-key="todo.id" id="todo.id" completed="todo.completed" title="todo.title"/>
        </t>
      </ul>
    </section>
    <footer class="footer" t-if="todos.length">
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
      <button class="clear-completed" t-if="todos.length gt remaining" t-on-click="dispatch('clearCompleted')">
        Clear completed
      </button>
    </footer>
  </section>

  <li t-name="TodoItem" class="todo" t-att-class="{completed: props.completed, editing: state.isEditing}">
    <div class="view">
      <input class="toggle" type="checkbox" t-on-change="dispatch('toggleTodo', props.id)" t-att-checked="props.completed"/>
      <label t-on-dblclick="state.isEditing = true">
        <t t-esc="props.title"/>
      </label>
      <button class="destroy" t-on-click="dispatch('removeTodo', props.id)"></button>
    </div>
    <input class="edit" t-ref="input" t-if="state.isEditing" t-att-value="props.title" t-on-keyup="handleKeyup" t-on-blur="handleBlur"/>
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

const RESPONSIVE = `// In this example, we show how we can modify keys in the global environment to
// make a responsive application.
//
// The main idea is to have a "isMobile" key in the environment, then listen
// to resize events and update the env if needed.  Then, the whole interface
// will be updated, creating and destroying components as needed.
//
// To see this in action, try resizing the window.  The application will switch
// to mobile mode whenever it has less than 768px.

//------------------------------------------------------------------------------
// Components
//------------------------------------------------------------------------------
class Navbar extends owl.Component {}

class MobileSearchView extends owl.Component {}

class ControlPanel extends owl.Component {}
ControlPanel.components = { MobileSearchView };

class AdvancedComponent extends owl.Component {}

class FormView extends owl.Component {}
FormView.components = { AdvancedComponent };

class Chatter extends owl.Component {
    messages = Array.from(Array(100).keys());
}

class App extends owl.Component {}
App.components = { Navbar, ControlPanel, FormView, Chatter };

//------------------------------------------------------------------------------
// Responsive plugin
//------------------------------------------------------------------------------
function setupResponsivePlugin(env) {
    const isMobile = () => window.innerWidth <= 768;
    env.isMobile = isMobile();
    const updateEnv = owl.utils.debounce(() => {
        if (env.isMobile !== isMobile()) {
            env.isMobile = !env.isMobile;
            env.qweb.forceUpdate();
        }
    }, 15);
    window.addEventListener("resize", updateEnv);
}

//------------------------------------------------------------------------------
// Application Startup
//------------------------------------------------------------------------------
const env = {
    qweb: new owl.QWeb({ templates: TEMPLATES}),
};
setupResponsivePlugin(env);

const app = new App(env);
app.mount(document.body);
`;

const RESPONSIVE_XML = `<templates>
  <div t-name="Navbar" class="navbar">Navbar</div>

  <div t-name="ControlPanel" class="controlpanel">
    <h2>Control Panel</h2>
    <MobileSearchView t-if="env.isMobile" />
  </div>

  <div t-name="FormView" class="formview">
    <h2>Form View</h2>
    <AdvancedComponent t-if="!env.isMobile" />
  </div>

  <div t-name="Chatter" class="chatter">
    <h2>Chatter</h2>
    <t t-foreach="messages" t-as="item"><div>Message <t t-esc="item"/></div></t>
  </div>

  <div t-name="MobileSearchView">Mobile searchview</div>

  <div t-name="AdvancedComponent">
    This component is only created in desktop mode.
    <button>Button!</button>
  </div>

  <div t-name="App" class="app" t-att-class="{mobile: env.isMobile, desktop: !env.isMobile}">
    <t t-set="maincontent">
      <FormView />
      <Chatter />
    </t>
    <Navbar/>
    <ControlPanel/>
    <div class="content-wrapper" t-if="!env.isMobile">
      <div class="content">
        <t t-raw="maincontent"/>
      </div>
    </div>
    <t t-else="1">
      <t t-raw="maincontent"/>
    </t>
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

const SLOTS = `// We show here how slots can be used to create generic components.
// In this example, the Card component is basically only a container. It is not
// aware of its content. It just knows where it should be (with t-slot).
// The parent component define the content with t-set.
//
// Note that the t-on-click event, defined in the App template, is executed in
// the context of the App component, even though it is inside the Card component
const { Component, useState } = owl;

class Card extends Component {
    state = useState({ showContent: true });

    toggleDisplay() {
        this.state.showContent = !this.state.showContent;
    }
}

class Counter extends Component {
    state = useState({val: 1});

    inc() {
        this.state.val++;
    }
}

// Main root component
class App extends Component {
    state = useState({a: 1, b: 3});

    inc(key, delta) {
        this.state[key] += delta;
    }
}
App.components = {Card, Counter};

// Application setup
const qweb = new owl.QWeb({ templates: TEMPLATES});
const app = new App({ qweb });
app.mount(document.body);`;

const SLOTS_XML = `<templates>
  <div t-name="Card" class="card" t-att-class="state.showContent ? 'full' : 'small'">
    <div class="card-title">
      <t t-esc="props.title"/><button t-on-click="toggleDisplay">Toggle</button>
    </div>
    <t t-if="state.showContent">
      <div class="card-content" >
        <t t-slot="content"/>
      </div>
      <div class="card-footer">
        <t t-slot="footer"/>
      </div>
    </t>
  </div>

  <div t-name="Counter">
    <t t-esc="state.val"/><button t-on-click="inc">Inc</button>
  </div>

  <div t-name="App" class="main">
    <Card title="'Title card A'">
      <t t-set="content">Content of card 1...  [<t t-esc="state.a"/>]</t>
      <t t-set="footer"><button t-on-click="inc('a', 1)">Increment A</button></t>
    </Card>
    <Card title="'Title card B'">
      <t t-set="content">
        <div>Card 2... [<t t-esc="state.b"/>]</div>
        <Counter />
      </t>
      <t t-set="footer"><button t-on-click="inc('b', -1)">Decrement B</button></t>
    </Card>
  </div>
</templates>`;

const SLOTS_CSS = `.main {
    display: flex;
}

.card {
    display: flex;
    flex-direction: column;
    background-color: #eeeeee;
    width: 200px;
    height: 100px;
    margin: 10px;
    border: 1px solid gray;
}

.card.full {
    height: 100px;
}

.card.small {
    height: 25px;
}

.card-title {
    flex: 0 0 25px;
    font-weight: bold;
    background-color: darkcyan;
    color: white;
    padding: 2px;
}

.card-title button {
    float: right;
}

.card-content {
    flex: 1 1 auto;
    padding: 5px;
    border-top: 1px solid white;
}

.card-footer {
    border-top: 1px solid white;
}`;

const ASYNC_COMPONENTS = `// This example will not work if your browser does not support ESNext class fields

// In this example, we have 2 sub components, one of them being async (slow).
// However, we don't want renderings of the other sub component to be delayed
// because of the slow component. We use the AsyncRoot component for this
// purpose. Try removing it to see the difference.
const { Component, useState } = owl;
const { AsyncRoot } = owl.misc;

class SlowComponent extends Component {
    willUpdateProps() {
        // simulate a component that needs to perform async stuff (e.g. an RPC)
        // with the updated props before re-rendering itself
        return new Promise(resolve => setTimeout(resolve, 1500));
    }
}

class NotificationList extends Component {}

class App extends Component {
    state = useState({ value: 0, notifs: [] });

    increment() {
        this.state.value++;
        const notif = "Value will be set to " + this.state.value;
        this.state.notifs.push(notif);
        setTimeout(() => {
            var index = this.state.notifs.indexOf(notif);
            this.state.notifs.splice(index, 1);
        }, 3000);
    }
}
App.components = {SlowComponent, NotificationList};

const qweb = new owl.QWeb({ templates: TEMPLATES});
const app = new App({ qweb });
app.mount(document.body);
`;

const ASYNC_COMPONENTS_XML = `<templates>
  <div t-name="App" class="app">
    <button t-on-click="increment">Increment</button>
    <SlowComponent value="state.value"/>
    <AsyncRoot>
      <NotificationList notifications="state.notifs"/>
    </AsyncRoot>
  </div>
  <div t-name="SlowComponent" class="value" >
    Current value: <t t-esc="props.value"/>
  </div>

  <div t-name="NotificationList" class="notification-list">
    <t t-foreach="props.notifications" t-as="notif">
      <div class="notification"><t t-esc="notif"/></div>
    </t>
  </div>
</templates>`;

const ASYNC_COMPONENTS_CSS = `.app {
    width: 70%;
}

button {
    color: darkred;
    font-size: 30px;
    width: 220px;
}

.value {
    font-size: 26px;
    padding: 20px;
}

.notification-list {
    position: absolute;
    top: 0;
    right: 0;
}

.notification {
    width: 150px;
    margin: 4px 8px;
    padding: 16px;
    border: 1px solid: black;
    background-color: lightgray;
}`;

const FORM = `// This example illustrate how the t-model directive can be used to synchronize
// data between html inputs (and select/textareas) and the state of a component.
// Note that there are two controls with t-model="color": they are totally
// synchronized.
const { Component, useState } = owl;

class Form extends Component {
    state = useState({
        text: "",
        othertext: "",
        number: 11,
        color: "",
        bool: false
    });
}

// Application setup
const qweb = new owl.QWeb({ templates: TEMPLATES});
const form = new Form({ qweb });
form.mount(document.body);
`;

const FORM_XML = `<templates>
  <div t-name="Form">
    <h1>Form</h1>
    <div>
      Text (immediate): <input t-model="state.text"/>
    </div>
    <div>
      Other text (lazy): <input t-model.lazy="state.othertext"/>
    </div>
    <div>
      Number: <input  t-model.number="state.number"/>
    </div>
    <div>
      Boolean: <input  type="checkbox" t-model="state.bool"/>
    </div>
    <div>
      Color, with a select:
      <select  t-model="state.color">
        <option value="">Select a color</option>
        <option value="red">Red</option>
        <option value="blue">Blue</option>
      </select>
    </div>
    <div>
      Color, with radio buttons:
        <span><input type="radio" name="color" id="red" value="red" t-model="state.color"/><label for="red">Red</label></span>
        <span><input type="radio" name="color" id="blue" value="blue" t-model="state.color"/><label for="blue">Blue</label></span>
    </div>
    <hr/>
    <h1>State</h1>
    <div>Text: <t t-esc="state.text"/></div>
    <div>Other Text: <t t-esc="state.othertext"/></div>
    <div>Number: <t t-esc="state.number"/></div>
    <div>Boolean: <t t-if="state.bool">True</t><t t-else="1">False</t></div>
    <div>Color: <t t-esc="state.color"/></div>
  </div>
</templates>
`;

const WMS = `// This example is slightly more complex than usual. We demonstrate
// here a way to manage sub windows in Owl, declaratively. This is still just a
// demonstration. Managing windows can be as complex as we want.  For example,
// we could implement the following features:
// - resizing windows
// - minimizing windows
// - configuration options for windows to make a window non resizeable
// - minimal width/height
// - better heuristic for initial window position
// - ...
const { Component, useState } = owl;
const { useRef } = owl.hooks;

class HelloWorld extends Component {}

class Counter extends Component {
  state = useState({ value: 0 });

  inc() {
    this.state.value++;
  }
}

class Window extends Component {

  get style() {
    let { width, height, top, left, zindex } = this.props.info;

    return \`width: \${width}px;height: \${height}px;top:\${top}px;left:\${left}px;z-index:\${zindex}\`;
  }

  close() {
    this.trigger("close-window", { id: this.props.info.id });
  }

  startDragAndDrop(ev) {
    this.updateZIndex();
    this.el.classList.add('dragging');
    const offsetX = this.props.info.left - ev.pageX;
    const offsetY = this.props.info.top - ev.pageY;
    let left, top;

    const el = this.el;
    const self = this;
    window.addEventListener("mousemove", moveWindow);
    window.addEventListener("mouseup", stopDnD, { once: true });

    function moveWindow(ev) {
      left = Math.max(offsetX + ev.pageX, 0);
      top = Math.max(offsetY + ev.pageY, 0);
      el.style.left = \`\${left}px\`;
      el.style.top = \`\${top}px\`;
    }
    function stopDnD() {
      window.removeEventListener("mousemove", moveWindow);
      const options = { id: self.props.info.id, left, top };
      self.el.classList.remove('dragging');
      self.trigger("set-window-position", options);
    }
  }

  updateZIndex() {
    this.trigger("update-z-index", { id: this.props.info.id });
  }
}

class WindowManager extends Component {
  windows = [];
  nextId = 1;
  currentZindex = 1;
  nextLeft = 0;
  nextTop = 0;

  addWindow(name) {
    const info = this.env.windows.find(w => w.name === name);
    this.nextLeft = this.nextLeft + 30;
    this.nextTop = this.nextTop + 30;
    this.windows.push({
      id: this.nextId++,
      title: info.title,
      width: info.defaultWidth,
      height: info.defaultHeight,
      top: this.nextTop,
      left: this.nextLeft,
      zindex: this.currentZindex++,
      component: info.component
    });
    this.render();
  }

  closeWindow(ev) {
    const id = ev.detail.id;
    delete this.constructor.components[id];
    const index = this.windows.findIndex(w => w.id === id);
    this.windows.splice(index, 1);
    this.render();
  }

  setWindowPosition(ev) {
    const id = ev.detail.id;
    const w = this.windows.find(w => w.id === id);
    w.top = ev.detail.top;
    w.left = ev.detail.left;
  }

  updateZIndex(ev) {
    const id = ev.detail.id;
    const w = this.windows.find(w => w.id === id);
    w.zindex = this.currentZindex++;
    ev.target.style["z-index"] = w.zindex;
  }
}
WindowManager.components = { Window };

class App extends Component {
  wmRef = useRef("wm");

  addWindow(name) {
    this.wmRef.comp.addWindow(name);
  }
}
App.components = { WindowManager };

const qweb = new owl.QWeb({ templates: TEMPLATES});
const windows = [
  {
    name: "Hello",
    title: "Hello",
    component: HelloWorld,
    defaultWidth: 200,
    defaultHeight: 100
  },
  {
    name: "Counter",
    title: "Click Counter",
    component: Counter,
    defaultWidth: 300,
    defaultHeight: 120
  }
];

const env = { qweb, windows };
const app = new App(env);
app.mount(document.body);
`;

const WMS_XML = `<templates>
  <div t-name="Window" class="window" t-att-style="style" t-on-click="updateZIndex">
    <div class="header">
      <span t-on-mousedown="startDragAndDrop"><t t-esc="props.info.title"/></span>
      <span class="close" t-on-click="close">×</span>
    </div>
    <t t-slot="default"/>
  </div>

  <div t-name="WindowManager" class="window-manager"
       t-on-close-window="closeWindow"
       t-on-update-z-index="updateZIndex"
       t-on-set-window-position="setWindowPosition">
    <Window t-foreach="windows" t-as="w" t-key="w.id" info="w">
      <t t-component="w.component"/>
    </Window>
  </div>

  <div t-name="App" class="app">
    <WindowManager t-ref="wm"/>
    <div class="menubar">
      <button t-on-click="addWindow('Hello')">Say Hello</button>
      <button t-on-click="addWindow('Counter')">Counter</button>
    </div>
  </div>

  <div t-name="HelloWorld">
    World
  </div>

  <div t-name="Counter" class="counter">
    <button t-on-click="inc">Inc</button>
    <span><t t-esc="state.value"/></span>
  </div>
</templates>
`;

const WMS_CSS = `body {
    margin: 0;
}

.app {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-rows: auto 50px;
}

.window-manager {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: #eeeeee;
    overflow: hidden;
}

.menubar {
    background-color: #875a7b;
    color: white;
}

.menubar button {
    height: 40px;
    font-size: 18px;
    margin: 5px;
}

.window {
    display: grid;
    grid-template-rows: 30px auto;
    border: 1px solid gray;
    background-color: white;
    position: absolute;
    box-shadow: 1px 1px 2px 1px grey;
}

.window.dragging {
    opacity: 0.75;
}

.window .header {
    background-color: #875a7b;
    display: grid;
    grid-template-columns: auto 24px;
    color: white;
    line-height: 30px;
    padding-left: 5px;
    cursor: default;
    user-select: none;
}

.window .header .close {
    cursor: pointer;
    font-size: 22px;
    padding-left: 4px;
    padding-right: 4px;
    font-weight: bold;
}

.counter {
    font-size: 20px;
}
.counter button {
    width: 80px;
    height:40px;
    font-size: 20px;
}`;

export const SAMPLES = [
  {
    description: "Components",
    code: COMPONENTS,
    xml: COMPONENTS_XML,
    css: COMPONENTS_CSS
  },
  {
    description: "Form Input Bindings",
    code: FORM,
    xml: FORM_XML
  },
  {
    description: "Animations",
    code: ANIMATION,
    xml: ANIMATION_XML,
    css: ANIMATION_CSS
  },
  {
    description: "Lifecycle demo",
    code: LIFECYCLE_DEMO,
    xml: LIFECYCLE_DEMO_XML,
    css: LIFECYCLE_CSS
  },
  {
    description: "Hooks",
    code: HOOKS_DEMO,
    xml: HOOKS_DEMO_XML,
    css: HOOKS_CSS
  },
  {
    description: "Context",
    code: CONTEXT_JS,
    xml: CONTEXT_XML,
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
    description: "Slots And Generic Components",
    code: SLOTS,
    xml: SLOTS_XML,
    css: SLOTS_CSS
  },
  {
      description: "Window Management System",
      code: WMS,
      xml: WMS_XML,
      css: WMS_CSS,
  },
  {
    description: "Asynchronous components",
    code: ASYNC_COMPONENTS,
    xml: ASYNC_COMPONENTS_XML,
    css: ASYNC_COMPONENTS_CSS
  }
];
