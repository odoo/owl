const COMPONENTS = /*js*/ `
// In this example, we show how components can be defined and created.
const { Component, useState, mount } = owl;

class Greeter extends Component {
    setup() {
        this.state = useState({ word: 'Hello' });
    }

    toggle() {
        this.state.word = this.state.word === 'Hi' ? 'Hello' : 'Hi';
    }
}
Greeter.template = "Greeter";

// Main root component
class App extends Component {
  setup() {
    this.state = useState({ name: 'World'});
  }
}
App.components = { Greeter };
App.template = "App";

// Application setup
mount(App, document.body)
`;

const COMPONENTS_XML = /*xml*/`
<templates>
  <div t-name="Greeter" class="greeter" t-on-click="toggle">
    <t t-esc="state.word"/>, <t t-esc="props.name"/>
  </div>

  <div t-name="App">
    <Greeter name="state.name"/>
  </div>
</templates>
`;

const COMPONENTS_CSS = /*css*/`
.greeter {
    font-size: 20px;
    width: 300px;
    height: 100px;
    margin: 5px;
    text-align: center;
    line-height: 100px;
    background-color: #eeeeee;
    user-select: none;
}`;

const LIFECYCLE_DEMO = /*js*/`
// This example shows all the possible lifecycle hooks
//
// The root component controls a sub component (DemoComponent). It logs all its lifecycle
// methods in the console.  Try modifying its state by clicking on it, or by
// clicking on the two main buttons, and look into the console to see what
// happens.
const { Component, useState, mount, onWillStart, onMounted, onWillUnmount, onWillUpdateProps, onPatched, onWillPatch } = owl;

class DemoComponent extends Component {
    setup() {
        this.state = useState({ n: 0 });
        console.log("setup");

        onWillStart(() => console.log("willstart"));
        onMounted(() => console.log("mounted"));
        onWillPatch(() => console.log("willPatch"));
        onWillUpdateProps((nextProps) => console.log("willUpdateProps", nextProps));
        onPatched(() => console.log("patched"));
        onWillUnmount(() => console.log("willUnmount"));
    }
    increment() {
        this.state.n++;
    }
}
DemoComponent.template = "DemoComponent";

class App extends Component {
    setup() {
        this.state = useState({ n: 0, flag: true });
    }

    increment() {
        this.state.n++;
    }

    toggleSubComponent() {
        this.state.flag = !this.state.flag;
    }
}
App.components = { DemoComponent };
App.template = "App";

mount(App, document.body);
`;

const LIFECYCLE_DEMO_XML = /*xml*/ `
<templates>
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

const LIFECYCLE_CSS = /*css*/`
button {
    font-size: 18px;
    margin: 5px;
}

.demo {
    margin: 10px;
    padding: 10px;
    background-color: #dddddd;
    width: 250px;
}`;

const HOOKS_DEMO = /*js*/ `
// In this example, we show how hooks can be used or defined.
const { mount, useState, onMounted, onWillUnmount } = owl;

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
    setup() {
        // simple state hook (reactive object)
        this.counter = useState({ value: 0 });

        // this hooks is bound to the 'mouse' property.
        this.mouse = useMouse();
    }

    increment() {
        this.counter.value++;
    }
}
App.template = "App";

// Application setup
mount(App, document.body);
`;

const HOOKS_DEMO_XML = /*xml*/ `
<templates>
  <div t-name="App">
    <button t-on-click="increment">Click! <t t-esc="counter.value"/></button>
    <div>Mouse: <t t-esc="mouse.x"/>, <t t-esc="mouse.y"/></div>
  </div>
</templates>
`;

const HOOKS_CSS = /*css*/ `button {
    width: 120px;
    height: 35px;
    font-size: 16px;
}`;

const TODO_APP_REACTIVITY = /*js*/ `
// This example is an implementation of the TodoList application, from the
// www.todomvc.com project.  This is a non trivial application with some
// interesting user interactions. It uses the local storage for persistence.
//
// In this implementation, we use the owl reactivity mechanism.
const { Component, useState, mount, useRef, onPatched, onMounted, reactive } = owl;

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
// TodoItem
//------------------------------------------------------------------------------
class TodoItem extends Component {
    setup() {
        useAutofocus("input");
        this.todo = this.env.todo;
        this.todoState = useState(this.todo.state);
        this.state = useState({});
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
        this.todo.updateTodo({title, id: this.props.id});
        this.state.isEditing = false;
    }
}
TodoItem.template = "TodoItem";

//------------------------------------------------------------------------------
// TodoApp
//------------------------------------------------------------------------------
class TodoApp extends Component {
    setup() {
        this.todo = this.env.todo;
        this.todoState = useState(this.todo.state);

        this.state = useState({ filter: "all" });
        this.setFilter = this.setFilter.bind(this);
    }

    get todos() {
      return this.todoState.todos;
    }

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
                this.todo.addTodo(title);
            }
            ev.target.value = "";
        }
    }

    setFilter(filter) {
        this.state.filter = filter;
    }
}
TodoApp.components = { TodoItem };
TodoApp.template = "TodoApp";

//------------------------------------------------------------------------------
// App Initialization
//------------------------------------------------------------------------------

function makeGlobalState(initialState, key) {
    const state = Object.assign(initialState, loadState());
    const reactiveState = reactive(state, () => saveState(reactiveState));
    // read everything to be notified afterwards
    saveState(reactiveState);

    function saveState(state) {
      const str = JSON.stringify(state);
      try {
        localStorage.setItem(key, str);
      } catch (e) {};
    }

    function loadState() {
        const localState = localStorage.getItem(key);
        return localState ? JSON.parse(localState) : {};
    }

    return { state: reactiveState };
}

function toDoService() {
    const { state } = makeGlobalState({ todos: [], nextId: 1}, LOCALSTORAGE_KEY);

    function addTodo(title) {
        const todo = {
            id: state.nextId++,
            title,
            completed: false
        }
        state.todos.push(todo);
    }

    function removeTodo(id) {
        const index = state.todos.findIndex(t => t.id === id);
        state.todos.splice(index, 1);
    }

    function updateTodo({id, title}) {
        const value = title.trim();
        if (!value) {
            removeTodo(id);
        } else {
            const todo = state.todos.find(t => t.id === id);
            todo.title = value;
        }
    }

    function toggleTodo(id) {
        const todo = state.todos.find(t => t.id === id);
        todo.completed = !todo.completed;
    }

    function clearCompleted() {
        for (let todo of state.todos.slice()) {
            if (todo.completed) {
                removeTodo(todo.id);
            }
        }
    }

    function toggleAll(completed) {
        for (let todo of state.todos) {
            todo.completed = completed;
        }
    }

    return {
      state, addTodo, removeTodo, updateTodo, toggleTodo, clearCompleted, toggleAll
    }
}

const env = {
  todo: toDoService(),
};
mount(TodoApp, document.body, { env });
`;

const TODO_APP_REACTIVITY_XML = /*xml*/ `
<templates>
  <section t-name="TodoApp" class="todoapp">
    <header class="header">
      <h1>todos</h1>
      <input class="new-todo" autofocus="true" autocomplete="off" placeholder="What needs to be done?" t-on-keyup="addTodo"/>
    </header>
    <section class="main" t-if="todos.length">
      <input class="toggle-all" id="toggle-all" type="checkbox" t-att-checked="allChecked" t-on-click="() => todo.toggleAll(!allChecked)"/>
      <label for="toggle-all"></label>
      <ul class="todo-list">
        <t t-foreach="visibleTodos" t-as="todo" t-key="todo.id">
          <TodoItem id="todo.id" completed="todo.completed" title="todo.title"/>
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
          <a t-on-click="() => setFilter('all')" t-att-class="{selected: state.filter === 'all'}">All</a>
        </li>
        <li>
          <a t-on-click="() => setFilter('active')" t-att-class="{selected: state.filter === 'active'}">Active</a>
        </li>
        <li>
          <a t-on-click="() => setFilter('completed')" t-att-class="{selected: state.filter === 'completed'}">Completed</a>
        </li>
      </ul>
      <button class="clear-completed" t-if="todos.length gt remaining" t-on-click="() => todo.clearCompleted()">
        Clear completed
      </button>
    </footer>
  </section>

  <li t-name="TodoItem" class="todo" t-att-class="{completed: props.completed, editing: state.isEditing}">
    <div class="view">
      <input class="toggle" type="checkbox" t-on-change="() => todo.toggleTodo(props.id)" t-att-checked="props.completed"/>
      <label t-on-dblclick="() => state.isEditing = true">
        <t t-esc="props.title"/>
      </label>
      <button class="destroy" t-on-click="() => todo.removeTodo(props.id)"></button>
    </div>
    <input class="edit" t-ref="input" t-if="state.isEditing" t-att-value="props.title" t-on-keyup="handleKeyup" t-on-blur="handleBlur"/>
  </li>
</templates>`;

const TODO_APP_REACTIVITY_CSS = /*css*/`
html,body {
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

const RESPONSIVE = /*js*/ `
// In this example, we show how we can modify keys in the global environment to
// make a responsive application.
//
// The main idea is to have a "isMobile" key in the environment, then listen
// to resize events and update the env if needed.  Then, the whole interface
// will be updated, creating and destroying components as needed.
//
// To see this in action, try resizing the window.  The application will switch
// to mobile mode whenever it has less than 768px.

const { debounce, useBus } = utils;

//------------------------------------------------------------------------------
// Components
//------------------------------------------------------------------------------
class Navbar extends owl.Component {}
Navbar.template = "Navbar";

class MobileSearchView extends owl.Component {}
MobileSearchView.template = "MobileSearchView";

class ControlPanel extends owl.Component {}
ControlPanel.components = { MobileSearchView };
ControlPanel.template = "ControlPanel";

class AdvancedComponent extends owl.Component {}
AdvancedComponent.template = "AdvancedComponent";

class FormView extends owl.Component {}
FormView.components = { AdvancedComponent };
FormView.template = "FormView";

class Chatter extends owl.Component {
    setup() {
        this.messages = Array.from(Array(100).keys());
    }
}
Chatter.template = "Chatter";

class App extends owl.Component {
    setup() {
        useResponsive();
    }
}
App.template = "App";
App.components = { Navbar, ControlPanel, FormView, Chatter };

//------------------------------------------------------------------------------
// Responsive plugin
//------------------------------------------------------------------------------

function responsiveService(env) {
    const getIsMobile = () => window.innerWidth <= 768;

    let isMobile = getIsMobile();
    const responsive = new owl.EventBus();

    env.isMobile = () => isMobile;
    const updateEnv = debounce(() => {
        if (isMobile !== getIsMobile()) {
            isMobile = !isMobile;
            responsive.trigger("resize");
        }
    }, 15);
    window.addEventListener("resize", updateEnv);
    return responsive;
}

function useResponsive() {
    const comp = owl.useComponent();
    const responsive = comp.env.responsive;
    useBus(responsive, "resize", () => comp.render());
}


//------------------------------------------------------------------------------
// Application Startup
//------------------------------------------------------------------------------
const env = {};
env.responsive = responsiveService(env);

owl.mount(App, document.body, { env });
`;

const RESPONSIVE_XML = /*xml*/`
<templates>
  <div t-name="Navbar" class="navbar">Navbar</div>

  <div t-name="ControlPanel" class="controlpanel">
    <h2>Control Panel</h2>
    <MobileSearchView t-if="env.isMobile()" />
  </div>

  <div t-name="FormView" class="formview">
    <h2>Form View</h2>
    <AdvancedComponent t-if="!env.isMobile()" />
  </div>

  <div t-name="Chatter" class="chatter">
    <h2>Chatter</h2>
    <t t-foreach="messages" t-as="item" t-key="item"><div>Message <t t-esc="item"/></div></t>
  </div>

  <div t-name="MobileSearchView">Mobile searchview</div>

  <div t-name="AdvancedComponent">
    This component is only created in desktop mode.
    <button>Button!</button>
  </div>

  <t t-name="maincontent">
    <FormView />
    <Chatter />
  </t>
  <div t-name="App" class="app" t-att-class="{mobile: env.isMobile(), desktop: !env.isMobile()}">
    <Navbar/>
    <ControlPanel/>
    <div class="content-wrapper" t-if="!env.isMobile()">
      <div class="content">
        <t t-call="maincontent"/>
      </div>
    </div>
    <t t-else="">
      <t t-call="maincontent"/>
    </t>
  </div>
</templates>
`;

const RESPONSIVE_CSS = /*css*/`
body {
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

const SLOTS = /*js*/ `
// We show here how slots can be used to create generic components.
// In this example, the Card component is basically only a container. It is not
// aware of its content. It just knows where it should be (with t-slot).
// The parent component define the content with t-set-slot.
//
// Note that the t-on-click event, defined in the App template, is executed in
// the context of the App component, even though it is inside the Card component
const { Component, useState, mount } = owl;

class Card extends Component {
    setup() {
        this.state = useState({ showContent: true });
    }

    toggleDisplay() {
        this.state.showContent = !this.state.showContent;
    }
}
Card.template = "Card";

class Counter extends Component {
    setup() {
        this.state = useState({val: 1});
    }

    inc() {
        this.state.val++;
    }
}
Counter.template = "Counter";

// Main root component
class App extends Component {
    setup() {
        this.state = useState({a: 1, b: 3});
        this.inc = this.inc.bind(this);
    }

    inc(key, delta) {
        this.state[key] += delta;
    }
}
App.components = {Card, Counter};
App.template = "App";

// Application setup
mount(App, document.body);
`;

const SLOTS_XML = /*xml*/`
<templates>
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
      <t t-set-slot="content">Content of card 1...  [<t t-esc="state.a"/>]</t>
      <t t-set-slot="footer"><button t-on-click="() => inc('a', 1)">Increment A</button></t>
    </Card>
    <Card title="'Title card B'">
      <t t-set-slot="content">
        <div>Card 2... [<t t-esc="state.b"/>]</div>
        <Counter />
      </t>
      <t t-set-slot="footer"><button t-on-click="() => inc('b', -1)">Decrement B</button></t>
    </Card>
  </div>
</templates>`;

const SLOTS_CSS = /*css*/ `
.main {
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

const FORM = /*js*/`
// This example illustrate how the t-model directive can be used to synchronize
// data between html inputs (and select/textareas) and the state of a component.
// Note that there are two controls with t-model="color": they are totally
// synchronized.
const { Component, useState, mount } = owl;

class Form extends Component {
    setup() {
        this.state = useState({
            text: "",
            othertext: "",
            number: 11,
            color: "",
            bool: false
        });
    }
}
Form.template = "Form";

// Application setup
mount(Form, document.body);
`;

const FORM_XML = /*xml*/ `
<templates>
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
    <div>Boolean: <t t-if="state.bool">True</t><t t-else="">False</t></div>
    <div>Color: <t t-esc="state.color"/></div>
  </div>
</templates>
`;

const PORTAL_COMPONENTS = /*js*/`
// This shows the expected use case of Portal
// which is to implement something similar
// to bootstrap modal
const { Component, useState, mount, Portal } = owl;

class Modal extends Component {}
Modal.components = { Portal };
Modal.template = "Modal";

class Dialog extends Component {}
Dialog.components = { Modal };
Dialog.template = "Dialog";

class Interstellar extends Component {}
Interstellar.template = "Interstellar";

// Main root component
class App extends Component {
    state = useState({
        name: 'Portal used for Dialog (Modal)',
        dialog: false,
        text: 'Hello !',
    });
}
App.components = { Dialog , Interstellar };
App.template = "App";

// Application setup
mount(App, document.body);
`;

const PORTAL_XML = /*xml*/`
<templates>
  <t t-name="Modal">
    <Portal target="'body'">
        <div class="owl-modal-supercontainer">
          <div class="owl-modal-backdrop"></div>
          <div class="owl-modal-container">
            <t t-slot="default" />
          </div>
        </div>
    </Portal>
  </t>

  <t t-name="Dialog">
    <Modal>
      <div class="owl-dialog-body">
        <t t-slot="default" />
      </div>
    </Modal>
  </t>

  <div t-name="Interstellar" class="owl-interstellar">
    <h4>This is a subComponent</h4>
    <p>The events it triggers will go through the Portal and be teleported
    on the other side of the wormhole it has created</p>
    <button t-on-click="props.collapseAll">Close the wormhole</button>
  </div>

  <div t-name="App">
    <div t-esc="state.name"/>
    <button t-on-click="() => state.dialog = true">Open Dialog</button>
    <Dialog t-if="state.dialog">
      <div t-esc="state.text"/>
      <Interstellar collapseAll="() => state.dialog = false"/>
    </Dialog>
  </div>
</templates>
`;

const PORTAL_CSS = /*css*/`
.owl-modal-supercontainer {
  position: static;
}
.owl-modal-backdrop {
    position: fixed;
    top: 0;
    left:0;
    background-color: #000000;
    opacity: 0.5;
    width: 100vw;
    height: 100vh;
    z-index: 1000;
}
.owl-modal-container {
    opacity:1;
    z-index: 1050;
    position: fixed;
    top: 0;
    left:0;
    width: 100%;
    height: 100%;
}
.owl-dialog-body {
    max-width: 500px;
    margin: 0 auto;
    position: relative;
    text-align: center;
    padding: 2rem;
    background-color: #FFFFFF;
    max-height: 100%;
}
.owl-interstellar {
    border: groove;
}`;

const WMS = /*js*/`
// This example is slightly more complex than usual. We demonstrate
// here a way to manage sub windows in Owl, declaratively. This is still just a
// demonstration. Managing windows can be as complex as we want.  For example,
// we could implement the following features:
// - resizing windows
// - minimizing windows
// - configuration options for windows to make a window non resizeable
// - minimal width/height
// - better heuristic for initial window position
// - ...
const { Component, useState, mount, useRef } = owl;
const { useBus } = utils;

class HelloWorld extends Component {}
HelloWorld.template = "HelloWorld";

class Counter extends Component {
  setup() {
    this.state = useState({ value: 0 });
  }

  inc() {
    this.state.value++;
  }
}
Counter.template = "Counter";

class Window extends Component {

  get style() {
    let { width, height, top, left, zindex } = this.props.info;

    return \`width: \${width}px;height: \${height}px;top:\${top}px;left:\${left}px;z-index:\${zindex}\`;
  }

  close() {
    this.env.wservice.close(this.props.info.id);
  }

  startDragAndDrop(ev) {
    this.updateZIndex();
    this.el.classList.add('dragging');

    const current = this.props.info;
    const offsetX = current.left - ev.pageX;
    const offsetY = current.top - ev.pageY;
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
      self.el.classList.remove('dragging');

      if (top !== undefined && left !== undefined) {
        current.top = top;
        current.left = left
      }
    }
  }

  updateZIndex() {
    this.env.wservice.updateZIndex(this.props.info, this.el);
  }
}
Window.template = "Window";

class WindowManager extends Component {
  setup() {
      useBus(this.env.wservice, "update", () => this.render());
  }
}
WindowManager.components = { Window };
WindowManager.template = "WindowManager";

class App extends Component {
  setup() {
      this.addWindow = this.addWindow.bind(this);
  }
  addWindow(name) {
      this.env.wservice.add(name);
  }
}
App.components = { WindowManager };
App.template = "App";

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

function windowService() {
    let activeWindows = [];
    let nextId = 0;
    const bus = new owl.EventBus();

    let nextTop = 0;
    let nextLeft = 0;
    let nextZIndex = 1;

    function add(name) {
        const info = windows.find((w) => w.name === name);

        activeWindows.push({
          id: nextId++,
          title: info.title,
          width: info.defaultWidth,
          height: info.defaultHeight,
          top: nextTop,
          left: nextLeft,
          zindex: nextZIndex++,
          component: info.component
        });

        bus.trigger("update");
        nextTop += 30;
        nextLeft += 30;
    }

    function close(id) {
        activeWindows = activeWindows.filter(w => w.id !== id);
        bus.trigger("update");
    }

    const wservice = Object.assign(bus, {
      add, close,
      updateZIndex(window, el) {
        window.zindex = nextZIndex++;
        el.style["z-index"] = window.zindex;
      }
    });

    Object.defineProperty(wservice, "activeWindows", {
        get() { return activeWindows; }
    })
    return wservice;
}

const env = {
  wservice: windowService(),
};

mount(App, document.body, { env });
`;

const WMS_XML =/*xml*/`
<templates>
  <div t-name="Window" class="window" t-att-style="style" t-on-click="updateZIndex">
    <div class="header">
      <span t-on-mousedown="startDragAndDrop"><t t-esc="props.info.title"/></span>
      <span class="close" t-on-click.stop="close">×</span>
    </div>
    <t t-slot="default"/>
  </div>

  <div t-name="WindowManager" class="window-manager">
    <Window t-foreach="env.wservice.activeWindows" t-as="w" t-key="w.id" info="w" setWindowPosition="setWindowPosition" updateZIndex="updateZIndex">
      <t t-component="w.component"/>
    </Window>
  </div>

  <div t-name="App" class="app">
    <WindowManager/>
    <div class="menubar">
      <button t-on-click="() => addWindow('Hello')">Say Hello</button>
      <button t-on-click="() => addWindow('Counter')">Counter</button>
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

const WMS_CSS=  /*css*/`
body {
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

const SFC =/*js*/`
// This example illustrates how Owl enables single file components,
// which include code, template and style.
//
// This is very useful in some situations, such as testing or quick prototyping.
// Note that this example has no external xml or css file, everything is
// contained in a single js file.

const { Component, useState, xml, css, mount } = owl;

// Counter component
const COUNTER_TEMPLATE = xml\`
  <button t-on-click="() => state.value++">
    Click! [<t t-esc="state.value"/>]
  </button>\`;

const COUNTER_STYLE = css\`
  button {
    color: blue;
  }\`;

class Counter extends Component {
  state = useState({ value: 0})
}
Counter.template = COUNTER_TEMPLATE;
Counter.style = COUNTER_STYLE;

// App
const APP_TEMPLATE = xml\`
  <div>
    <Counter/>
    <Counter/>
  </div>\`;

class App extends Component {}
App.template = APP_TEMPLATE;
App.components = { Counter };

// Application setup
mount(App, document.body);
`;




const TRANSITION = /*js*/`

const { xml, Component, App } = owl;
const nodeProto = Node.prototype;
const nodeInsertBefore = nodeProto.insertBefore;

function nodePropertiesForTransition() {
  const property = Object.getOwnPropertyDescriptor(Node.prototype, "insertBefore");

  Object.defineProperty(Node.prototype, "insertBefore", {
    get() {
      return function(inserted, ref) {
        if (inserted.hasAttribute("__transitions__")) {
          inserted.classList.add(inserted.getAttribute("__transitions__"));
        }
        nodeInsertBefore.call(this, ...arguments);
      } 
    }
  });

  return () => {
    Object.defineProperty(Node.prototype, "insertBefore", property);
  }
}

function MakeTransitionable(C, transitions) {
  const transitionableName  = C.template + "__transition";
  
  let originGetTemplate;
  class _Transitionable extends C {
    constructor(props, env, node) {
        if (transitionableName in node.app.rawTemplates) {
          super(...arguments);
          return;
        }
        const tmplString = node.app.rawTemplates[C.template];
        const doc = new DOMParser().parseFromString(tmplString, "text/xml")
        for (const { sel , cls} of transitions) {
          const elms = doc.querySelectorAll(sel);
          for (const el of elms) {
            el.setAttribute("__transitions__", cls);
          }
        }
        node.app.rawTemplates[transitionableName] = new XMLSerializer().serializeToString(doc);

        originGetTemplate = node.app.getTemplate;
        node.app.getTemplate = (...args) => {
          const undo = nodePropertiesForTransition();
          const tmplFn = originGetTemplate.call(node.app, ...args);
          undo();
          return tmplFn;
        }

        super(...arguments);
    }
    setup() {
      if (originGetTemplate) {
        this.__owl__.app.getTemplate = originGetTemplate;
        originGetTemplate = null;
      }
      super.setup();
    }
  }
  _Transitionable.template = transitionableName
  return _Transitionable;
}

class Transition extends Component {}
Transition.template = xml\`<div/>\`

class Root extends Component {}
Root.template = xml\`<div><Transition/></div> \`;
Root.components = { Transition: MakeTransitionable(Transition, [{sel: "div", cls:"prout"}]) };

new App(Root).mount(document.body);
`;




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
    description: "Single File Components",
    code: SFC
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
    description: "Todo List App (with reactivity)",
    code: TODO_APP_REACTIVITY,
    css: TODO_APP_REACTIVITY_CSS,
    xml: TODO_APP_REACTIVITY_XML
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
    description: "Portal (Dialog)",
    code: PORTAL_COMPONENTS,
    xml: PORTAL_XML,
    css: PORTAL_CSS,
  },
  {
    description: "Transition",
    code: TRANSITION,
  },
];
