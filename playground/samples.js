const COMPONENTS = /*js*/ `
// In this example, we show how components can be defined and created.
const { Component, useState, mount } = owl;

class Greeter extends Component {
    static template = "Greeter";
    
    setup() {
        this.state = useState({ word: 'Hello' });
    }

    toggle() {
        this.state.word = this.state.word === 'Hi' ? 'Hello' : 'Hi';
    }
}

// Main root component
class Root extends Component {
    static components = { Greeter };
    static template = "Root"

    setup() {
        this.state = useState({ name: 'World'});
    }
}

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true });`;

const COMPONENTS_XML = /*xml*/`
<templates>
  <div t-name="Greeter" class="greeter" t-on-click="toggle">
    <t t-esc="state.word"/>, <t t-esc="props.name"/>
  </div>

  <t t-name="Root">
    <Greeter name="state.name"/>
  </t>
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
const { Component, useState, mount, useComponent, onWillStart, onMounted, onWillUnmount, onWillUpdateProps, onPatched, onWillPatch, onWillRender, onRendered, onWillDestroy} = owl;

function useLogLifecycle() {
    const component = useComponent();
    const name = component.constructor.name;
    onWillStart(() => console.log(\`\${name}:willStart\`));
    onMounted(() => console.log(\`\${name}:mounted\`));
    onWillUpdateProps(() => console.log(\`\${name}:willUpdateProps\`));
    onWillRender(() => console.log(\`\${name}:willRender\`));
    onRendered(() => console.log(\`\${name}:rendered\`));
    onWillPatch(() => console.log(\`\${name}:willPatch\`));
    onPatched(() => console.log(\`\${name}:patched\`));
    onWillUnmount(() => console.log(\`\${name}:willUnmount\`));
    onWillDestroy(() => console.log(\`\${name}:willDestroy\`));
}

class DemoComponent extends Component {
    static template = "DemoComponent";

    setup() {
        useLogLifecycle();
        this.state = useState({ n: 0 });
    }
    increment() {
        this.state.n++;
    }
}

class Root extends Component {
    static template = "Root";
    static components = { DemoComponent };

    setup() {
        useLogLifecycle();
        this.state = useState({ n: 0, flag: true });
    }

    increment() {
        this.state.n++;
    }

    toggleSubComponent() {
        this.state.flag = !this.state.flag;
    }
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
`;

const LIFECYCLE_DEMO_XML = /*xml*/ `
<templates>
  <div t-name="DemoComponent" t-on-click="increment" class="demo">
    <div>Demo Sub Component</div>
    <div>(click on me to update me)</div>
    <div>Props: <t t-esc="props.n"/>, State: <t t-esc="state.n"/>. </div>
  </div>

  <div t-name="Root">
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
const { Component, mount, useState, onWillDestroy } = owl;

// We define here a custom behaviour: this hook tracks the state of the mouse
// position
function useMouse() {
    const position = useState({x:0, y: 0});

    function update(e) {
      position.x = e.clientX;
      position.y = e.clientY;
    }
    window.addEventListener('mousemove', update);
    onWillDestroy(() => {
        window.removeEventListener('mousemove', update);
    });

    return position;
}


// Main root component
class Root extends Component {
    static template = "Root";

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

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true });
`;

const HOOKS_DEMO_XML = /*xml*/ `
<templates>
  <div t-name="Root">
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
const { Component, useState, mount, useRef, onPatched, onMounted, reactive, useEnv, useEffect } = owl;

//------------------------------------------------------------------------------
// Constants, helpers
//------------------------------------------------------------------------------
const ENTER_KEY = 13;
const ESC_KEY = 27;
const LOCALSTORAGE_KEY = "todomvc";

function useAutofocus(name) {
    let ref = useRef(name);
    useEffect(el => el && el.focus(), () => [ref.el]);
}

function useStore() {
    const env = useEnv();
    return useState(env.store);
}

//------------------------------------------------------------------------------
// Task store
//------------------------------------------------------------------------------
class TaskList {
    constructor(tasks) {
        this.tasks = tasks || [];
        const taskIds = this.tasks.map((t) => t.id);
        this.nextId = taskIds.length ? Math.max(...taskIds) + 1 : 1;
    }

    addTask(text) {
        text = text.trim();
        if (text) {
            const task = {
                id: this.nextId++,
                text: text,
                isCompleted: false,
            };
            this.tasks.push(task);
        }
    }

    toggleTask(task) {
        task.isCompleted = !task.isCompleted;
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        task.isCompleted = !task.isCompleted;
    }

    toggleAll(value) {
        for (let task of this.tasks) {
            task.isCompleted = value;
        }
    }
    
    clearCompleted() {
        const tasks = this.tasks.filter(t => t.isCompleted);
        for (let task of tasks) {
            this.deleteTask(task);
        }
    }
    
    deleteTask(id) {
        const index = this.tasks.findIndex((t) => t.id === id);
        this.tasks.splice(index, 1);
    }
    
    updateTask(id, text) {
        const value = text.trim();
        if (!value) {
            this.deleteTask(id);
        } else {
            const task = this.tasks.find(t => t.id === id);
            task.text = value;
        }
    }
}

function createTaskStore() {
    const saveTasks = () => localStorage.setItem("todoapp", JSON.stringify(taskStore.tasks));
    const initialTasks = JSON.parse(localStorage.getItem("todoapp") || "[]");
    const taskStore = reactive(new TaskList(initialTasks), saveTasks);
    saveTasks();
    return taskStore;
}
  
//------------------------------------------------------------------------------
// Todo
//------------------------------------------------------------------------------
class Todo extends Component {
    static template = "Todo";
    
    setup() {
        useAutofocus("input");
        this.store = useStore();
        this.state = useState({
            isEditing: false
        });
    }

    handleKeyup(ev) {
        if (ev.keyCode === ENTER_KEY) {
            this.updateText(ev.target.value);
        }
        if (ev.keyCode === ESC_KEY) {
            ev.target.value = this.props.text;
            this.state.isEditing = false;
        }
    }

    handleBlur(ev) {
        this.updateText(ev.target.value);
    }

    updateText(text) {
        this.store.updateTask(this.props.id, text);
        this.state.isEditing = false;
    }
}

//------------------------------------------------------------------------------
// TodoList
//------------------------------------------------------------------------------
class TodoList extends Component {
    static template = "TodoList";
    static components = { Todo };
    
    setup() {
        this.store = useStore();
        this.state = useState({ filter: "all" });
    }

    get displayedTasks() {
      const tasks = this.store.tasks;
      switch (this.state.filter) {
        case "active":
          return tasks.filter((t) => !t.isCompleted);
        case "completed":
          return tasks.filter((t) => t.isCompleted);
        case "all":
          return tasks;
      }
    }
    
    get allChecked() {
        return this.store.tasks.every(todo => todo.isCompleted);
    }

    get remaining() {
        return this.store.tasks.filter(todo => !todo.isCompleted).length;
    }

    get remainingText() {
        const items = this.remaining < 2 ? "item" : "items";
        return \` \${items} left\`;
    }

    addTodo(ev) {
        if (ev.keyCode === ENTER_KEY) {
            const text = ev.target.value;
            if (text.trim()) {
                this.store.addTask(text);
            }
            ev.target.value = "";
        }
    }

    setFilter(filter) {
        this.state.filter = filter;
    }
}

//------------------------------------------------------------------------------
// App Initialization
//------------------------------------------------------------------------------
const env = { store: createTaskStore() };
mount(TodoList, document.body, { env, templates: TEMPLATES, dev: true });
`;

const TODO_APP_REACTIVITY_XML = /*xml*/ `
<templates>
  <section t-name="TodoList" class="todoapp">
    <header class="header">
      <h1>todos</h1>
      <input class="new-todo" autofocus="true" autocomplete="off" placeholder="What needs to be done?" t-on-keyup="addTodo"/>
    </header>
    <section class="main" t-if="store.tasks.length">
      <input class="toggle-all" id="toggle-all" type="checkbox" t-att-checked="allChecked" t-on-click="() => store.toggleAll(!allChecked)"/>
      <label for="toggle-all"></label>
      <ul class="todo-list">
        <t t-foreach="displayedTasks" t-as="todo" t-key="todo.id">
          <Todo id="todo.id" isCompleted="todo.isCompleted" text="todo.text"/>
        </t>
      </ul>
    </section>
    <footer class="footer" t-if="store.tasks.length">
      <span class="todo-count">
        <strong>
            <t t-esc="remaining"/>
        </strong>
        <t t-esc="remainingText"/>
      </span>
      <ul class="filters">
        <li>
          <a t-on-click="() => this.setFilter('all')" t-att-class="{selected: state.filter === 'all'}">All</a>
        </li>
        <li>
          <a t-on-click="() => this.setFilter('active')" t-att-class="{selected: state.filter === 'active'}">Active</a>
        </li>
        <li>
          <a t-on-click="() => this.setFilter('completed')" t-att-class="{selected: state.filter === 'completed'}">Completed</a>
        </li>
      </ul>
      <button class="clear-completed" t-if="store.tasks.length gt remaining" t-on-click="() => store.clearCompleted()">
        Clear completed
      </button>
    </footer>
  </section>

  <li t-name="Todo" class="todo" t-att-class="{completed: props.isCompleted, editing: state.isEditing}">
    <div class="view">
      <input class="toggle" type="checkbox" t-on-change="() => store.toggleTask(props.id)" t-att-checked="props.completed"/>
      <label t-on-dblclick="() => state.isEditing = true">
        <t t-esc="props.text"/>
      </label>
      <button class="destroy" t-on-click="() => store.deleteTask(props.id)"></button>
    </div>
    <input class="edit" t-ref="input" t-if="state.isEditing" t-att-value="props.text" t-on-keyup="handleKeyup" t-on-blur="handleBlur"/>
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
// In this example, we show how one can design an application that is responsive:
// its UI is different in mobile mode or in desktop mode.
//
// The main idea is to have a "isMobile" key in the environment, then listen
// to resize events and update the env if needed.  Then, the whole interface
// will be updated, creating and destroying components as needed.
//
// To see this in action, try resizing the window.  The application will switch
// to mobile mode whenever it has less than 768px.
const { Component, useState, mount, reactive, useEnv } = owl;

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    function later() {
      timeout = null;
      if (!immediate) {
        func.apply(context, args);
      }
    }
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      func.apply(context, args);
    }
  };
}

//------------------------------------------------------------------------------
// Responsive hook
//------------------------------------------------------------------------------

function createUI() {
  const getIsMobile = () => window.innerWidth <= 768;

  const ui = reactive({ isMobile: getIsMobile() });

    const updateEnv = debounce(() => {
      const isMobile = getIsMobile();
        if (ui.isMobile !== isMobile) {
            ui.isMobile = isMobile;
        }
    }, 15);
    window.addEventListener("resize", updateEnv);
    return ui;
}

function useUI() {
  const env = useEnv();
  return useState(env.ui);
}


//------------------------------------------------------------------------------
// Components
//------------------------------------------------------------------------------
class Navbar extends owl.Component {
  static template = "Navbar";
}

class MobileSearchView extends Component {
  static template = "MobileSearchView";
}

class ControlPanel extends Component {
  static template = "ControlPanel";
  static components = { MobileSearchView };
  setup() {
    this.ui = useUI();
  }
}

class AdvancedComponent extends Component {
  static template = "AdvancedComponent";
}

class FormView extends Component {
  static template = "FormView";
  static components = { AdvancedComponent };
  setup() {
    this.ui = useUI();
  }
}

class Chatter extends Component {
    static template = "Chatter";

    setup() {
        this.messages = Array.from(Array(100).keys());
    }
}

class Root extends Component {
  static template = "Root";
  static components = { Navbar, ControlPanel, FormView, Chatter };

  setup() {
    this.ui = useUI();
  }
}



//------------------------------------------------------------------------------
// Application Startup
//------------------------------------------------------------------------------
const env = {
  ui: createUI()
};

mount(Root, document.body, { templates: TEMPLATES, env });
`;

const RESPONSIVE_XML = /*xml*/`
<templates>
  <div t-name="Navbar" class="navbar">Navbar</div>

  <div t-name="ControlPanel" class="controlpanel">
    <h2>Control Panel</h2>
    <MobileSearchView t-if="ui.isMobile" />
  </div>

  <div t-name="FormView" class="formview">
    <h2>Form View</h2>
    <AdvancedComponent t-if="!ui.isMobile" />
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
  <div t-name="Root" class="app" t-att-class="{mobile: ui.isMobile, desktop: !ui.isMobile}">
    <Navbar/>
    <ControlPanel/>
    <div class="content-wrapper" t-if="!ui.isMobile">
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
// Note that the t-on-click event, defined in the Root template, is executed in
// the context of the Root component, even though it is inside the Card component
const { Component, useState, mount } = owl;

class Card extends Component {
  static template = "Card";
  
  setup() {
    this.state = useState({ showContent: true });
  }

  toggleDisplay() {
    this.state.showContent = !this.state.showContent;
  }
}

class Counter extends Component {
  static template = "Counter";
  
  setup() {
    this.state = useState({val: 1});
  }

  inc() {
    this.state.val++;
  }
}

// Main root component
class Root extends Component {
  static template = "Root"
  static components = { Card, Counter };
  
  setup() {
    this.state = useState({a: 1, b: 3});
  }

  inc(key, delta) {
    this.state[key] += delta;
  }
}

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true});
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

  <div t-name="Root" class="main">
    <Card title="'Title card A'">
      <t t-set-slot="content">Content of card 1...  [<t t-esc="state.a"/>]</t>
      <t t-set-slot="footer"><button t-on-click="() => this.inc('a', 1)">Increment A</button></t>
    </Card>
    <Card title="'Title card B'">
      <t t-set-slot="content">
        <div>Card 2... [<t t-esc="state.b"/>]</div>
        <Counter />
      </t>
      <t t-set-slot="footer"><button t-on-click="() => this.inc('b', -1)">Decrement B</button></t>
    </Card>
  </div>
</templates>
`;

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
  static template = "Form";

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

// Application setup
mount(Form, document.body, { templates: TEMPLATES, dev: true });
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
const { Component, useState, mount, useRef, reactive, useEnv, onMounted } = owl;

// -----------------------------------------------------------------------------
// Window manager code
// -----------------------------------------------------------------------------

class WindowManager {
  // contains all components with metadata
  static Windows = {};
  windows = {}; // mapping id => info
  nextId = 1;

  add(type) {
    const Comp = WindowManager.Windows[type];
    const left = 50 + Math.round(Math.random()*(window.innerWidth - 50 - Comp.defaultWidth));
    const top = 50 + Math.round(Math.random()*(window.innerHeight - 100 - Comp.defaultHeight));
    const id = this.nextId++;
    this.windows[id] = {
      id, 
      title: Comp.defaultTitle,
      width: Comp.defaultWidth,
      height: Comp.defaultHeight,
      left,
      top,
      Component: Comp,
    };
  }
  
  close(id) {
    delete this.windows[id];
  }

  updatePosition(id, left, top) {
    const w = this.windows[id];
    w.left = left;
    w.top = top;
  }

  getWindows() {
    return Object.values(this.windows);
  }
}

function createWindowService() {
  return reactive(new WindowManager());
}

function useWindowService() {
  const env = useEnv();
  return useState(env.windowService);
}

// -----------------------------------------------------------------------------
// Generic Window Component
// -----------------------------------------------------------------------------

class Window extends Component {
  static template = "Window";
  static nextZIndex = 1;
  zIndex = 0;

  setup() {
    this.windowService = useWindowService();
    this.root = useRef('root');
    onMounted(this.updateZIndex);
  }

  get style() {
    let { width, height, top, left } = this.props.info;
    return \`width: $\{width}px;height: $\{height}px;top:$\{top}px;left:$\{left}px;z-index:\${this.zIndex}\`;
  }

  close() {
    this.windowService.close(this.props.info.id);
  }

  startDragAndDrop(ev) {
    this.updateZIndex();
    const self = this;
    const root = this.root;

    const el = root.el;
    el.classList.add('dragging');

    const current = this.props.info;
    const offsetX = current.left - ev.pageX;
    const offsetY = current.top - ev.pageY;
    let left, top;

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
      el.classList.remove('dragging');

      if (top !== undefined && left !== undefined) {
        self.windowService.updatePosition(current.id, left, top);
      }
    }
  }

  updateZIndex() {
    this.zIndex = Window.nextZIndex++;
    this.root.el.style['z-index'] = this.zIndex;
  }
}

// -----------------------------------------------------------------------------
// Two concrete Window type implementations
// -----------------------------------------------------------------------------

class HelloWorld extends Component {
  static template = "HelloWorld";
  static defaultTitle = "Hello Owl!";
  static defaultWidth = 200;
  static defaultHeight = 100;
}


class Counter extends Component {
  static template = "Counter";
  static defaultTitle = "Click Counter";
  static defaultWidth = 300;
  static defaultHeight = 120;
  
  state = useState({ value: 0 });
  
  inc() {
    this.state.value++;
  }
}

// register window components
WindowManager.Windows.Hello = HelloWorld;
WindowManager.Windows.Counter = Counter;

// -----------------------------------------------------------------------------
// Window Container
// -----------------------------------------------------------------------------

class WindowContainer extends Component {
  static template = "WindowContainer";
  static components = { Window };
    
  setup() {
    this.windowService = useWindowService();
  }
}

// -----------------------------------------------------------------------------
// Root Component
// -----------------------------------------------------------------------------

class Root extends Component {
  static template = "Root";
  static components = { WindowContainer };
    
  setup() {
    this.windowService = useWindowService();
  }
  
  addWindow(type) {
    this.windowService.add(type);
  }
}

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------

const env = {
  windowService: createWindowService(),
};

mount(Root, document.body, { templates: TEMPLATES, env, dev: true });
`;

const WMS_XML =/*xml*/`
<templates>
  <div t-name="Window" class="window" t-att-style="style" t-on-click="updateZIndex" t-ref="root">
    <div class="header">
      <span t-on-mousedown="startDragAndDrop"><t t-esc="props.info.title"/></span>
      <span class="close" t-on-click.stop="close">×</span>
    </div>
    <t t-slot="default"/>
  </div>

  <div t-name="WindowContainer" class="window-manager">
    <Window t-foreach="windowService.getWindows()" t-as="w" t-key="w.id" info="w">
      <t t-component="w.Component"/>
    </Window>
  </div>

  <div t-name="Root" class="app">
    <WindowContainer/>
    <div class="menubar">
      <button t-on-click="() => this.addWindow('Hello')">Say Hello</button>
      <button t-on-click="() => this.addWindow('Counter')">Counter</button>
    </div>
  </div>

  <div t-name="HelloWorld">
    Some content here...
  </div>

  <div t-name="Counter" class="counter">
    <button t-on-click="inc">Click</button>
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
// This example illustrates how one can write Owl components with
// inline templates.

const { Component, useState, xml, css, mount } = owl;

// Counter component
class Counter extends Component {
  static template = xml\`
    <button t-on-click="() => state.value++">
      Click! [<t t-esc="state.value"/>]
    </button>\`;

  state = useState({ value: 0})
}

// Root
class Root extends Component {
  static template = xml\`
    <div>
      <Counter/>
      <Counter/>
    </div>\`;
  
  static components = { Counter };
}

// Application setup
mount(Root, document.body, { templates: TEMPLATES, dev: true});
`;

const BENCHMARK_JS = `
const { Component, mount, xml, useState, onWillRender, onPatched} = owl;

// -----------------------------------------------------------------------------
// Data generation
// -----------------------------------------------------------------------------

let idCounter = 1;
const adjectives = [
    "pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain",
    "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd",
    "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
const colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

function _random (max) { return Math.round(Math.random() * 1000) % max; };

function buildData(count) {
    const data = new Array(count);
    for (let i = 0; i < count; i++) {
        const label = \`\${adjectives[_random(adjectives.length)]} \${colours[_random(colours.length)]} \${nouns[_random(nouns.length)]}\`;
        data[i] = {
            id: idCounter++,
            label,
        };
    }
    return data;
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
class Button extends Component {
  static template = xml\`
      <div class='col-sm-6 smallpad'>
          <button t-att-id="props.id" class='btn btn-primary btn-block' type='button' t-on-click="props.onClick">
              <t t-esc="props.text"/>
          </button>
      </div>\`;
}


class Row extends Component {
  static template = xml\`
      <tr t-att-class="props.isSelected ? 'danger' : ''">
          <td class="col-md-1" t-esc="props.row.id" />
          <td class="col-md-4">
              <a t-on-click="() => props.onSelect(props.row.id)" t-esc="props.row.label" />
          </td>
          <td class="col-md-1">
              <a t-on-click="() =>  props.onRemove(props.row.id)" class="remove">[x]
                <span class='glyphicon glyphicon-remove' aria-hidden="true" />
              </a>
          </td>
          <td class='col-md-6'/>
      </tr>\`
}

class Root extends Component {
  static template = xml\`
      <div class='container'>
        <div class='jumbotron'>
          <div class='row'>
            <div class='col-md-6'>
              <h1>Owl Keyed</h1>
            </div>
            <div class='col-md-6'>
              <div class='row'>
                <Button id="'run'" onClick.bind="run" text="'Create 1,000 rows'" />
                <Button id="'runlots'" onClick.bind="runLots" text="'Create 10,000 rows'" />
                <Button id="'add'" onClick.bind="add" text="'Append 1,000 rows'" />
                <Button id="'update'" onClick.bind="update" text="'Update every 10th row'" />
                <Button id="'clear'" onClick.bind="clear" text="'Clear'" />
                <Button id="'swaprows'" onClick.bind="swapRows" text="'Swap Rows'" />
              </div>
            </div>
          </div>
        </div>
        <table class='table table-hover table-striped test-data'>
          <tbody>
            <t t-foreach="state.rows" t-as="row" t-key="row.id">
                <Row row="row" isSelected="row.id === state.selectedRowId" onSelect.bind="selectRow" onRemove.bind="removeRow"/>
            </t>
          </tbody>
        </table>
        <span class='preloadicon glyphicon glyphicon-remove' aria-hidden="true" />
      </div>\`;

  static components = { Button, Row };

  setup() {
      this.state = useState({
          rows: [],
          selectedRowId: null
      });
      this.benchmarking = false;
      onPatched(() => {
          if (this.benchmarking) {
              this.stop();
          }
      });
    }
    
    start(descr) {
        this.benchmarking = \`[\${descr}]\`;
        console.time(this.benchmarking);
    }
    stop() {
        console.timeEnd(this.benchmarking);
        this.benchmarking = false;  
    }

    run() {
        this.start('add1000');
        this.state.rows = buildData(1000);
        this.state.selectedRowId = null;
    }
    
    runLots() {
        this.start('add10_000');
        this.state.rows = buildData(10_000);
        this.state.selectedRowId = null;
    }
    
    add() {
        this.start('append1000');
        this.state.rows = this.state.rows.concat(buildData(1000));
    }
    
    update() {
        this.start('update1/10th');
        let index = 0;
        const rows = this.state.rows;
        while (index < rows.length) {
            rows[index].label = rows[index].label + " !!!";
            index += 10;
        }
    }
    
    clear() {
        this.start('clear');
        this.state.rows = [];
        this.state.selectedRowId = null;
    }
    
    swapRows() {
        this.start('swap');
        const rows = this.state.rows;
        if (rows.length > 998) {
            let tmp = rows[1];
            rows[1] = rows[998];
            rows[998] = tmp;
        }
    }
    
    selectRow(id) {
        this.start('select');
        this.state.selectedRowId = id;
    }
    
    removeRow(id) {
        this.start('remove1');
        const rows = this.state.rows;
        rows.splice(rows.findIndex(row => row.id === id), 1);
    }
}


mount(Root, document.body, { templates: TEMPLATES, dev: true });

`;

const BENCHMARK_CSS =  `
tr.danger {
  font-weight: bold;
}

.remove:hover {
  font-weight: bold;
}
.remove {
  cursor: pointer;
}
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
    description: "Inline templates",
    code: SFC
  },
  {
    description: "Lifecycle demo",
    code: LIFECYCLE_DEMO,
    xml: LIFECYCLE_DEMO_XML,
    css: LIFECYCLE_CSS
  },
  {
    description: "Customized hook",
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
    description: "Benchmark example",
    code: BENCHMARK_JS,
    css: BENCHMARK_CSS,
  },
];
