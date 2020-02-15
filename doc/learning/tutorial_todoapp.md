# 🦉 OWL Tutorial: TodoApp 🦉

For this tutorial, we will build a very simple Todo list application. The app
should satisfy the following requirements:

- let the user create and remove tasks
- tasks can be marked as completed
- tasks can be filtered to display active/completed tasks

This project will be an opportunity to discover and learn some important Owl
concepts, such as components, store, and how to organize an application.

## Content

1. [Setting up the project](#1-setting-up-the-project)
2. [Adding a first component](#2-adding-a-first-component)
3. [Displaying a list of tasks](#3-displaying-a-list-of-tasks)
4. [Layout: some basic css](#4-layout-some-basic-css)
5. [Extracting Task as a subcomponent](#5-extracting-task-as-a-subcomponent)
6. [Adding tasks (part 1)](#6-adding-tasks-part-1)
7. [Adding tasks (part 2)](#7-adding-tasks-part-2)
8. [Toggling tasks](#8-toggling-tasks)
9. [Deleting tasks](#9-deleting-tasks)
10. [Using a store](#10-using-a-store)
11. [Saving tasks in local storage](#11-saving-tasks-in-local-storage)
12. [Filtering tasks](#12-filtering-tasks)
13. [The Final Touch](#13-the-final-touch)
14. [Final Code](#final-code)

## 1. Setting up the project

For this tutorial, we will do a very simple project, with static files and
no additional tooling. The first step is to create the following file structure:

```
todoapp/
    index.html
    app.css
    app.js
    owl.js
```

The entry point for this application is the file `index.html`, which should have
the following content:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>OWL Todo App</title>
    <link rel="stylesheet" href="app.css" />
    <script src="owl.js"></script>
    <script src="app.js"></script>
  </head>
  <body></body>
</html>
```

Then, `app.css` can be left empty for now. It will be useful later on to style
our application. `app.js` is where we will write all our code. For now, let's
just put the following code:

```js
(function() {
  console.log("hello owl", owl.__info__.version);
})();
```

Note that we put everything inside an immediately executed function to avoid leaking
anything to the global scope.

Finally, `owl.js` should be the last version downloaded from the Owl repository (you can use `owl.min.js` if you prefer).

Now, the project should be ready. Loading the `index.html` file into a browser
should show an empty page, with the title `Owl Todo App`, and it should log a
message such as `hello owl 1.0.0` in the console.

## 2. Adding a first component

An Owl application is made out of [components](../reference/component.md), with
a single root component. Let us start by defining an `App` component. Replace the
content of the function in `app.js` by the following code:

```js
const { Component } = owl;
const { xml } = owl.tags;
const { whenReady } = owl.utils;

// Owl Components
class App extends Component {
  static template = xml`<div>todo app</div>`;
}

// Setup code
function setup() {
  const app = new App();
  app.mount(document.body);
}

whenReady(setup);
```

Now, reloading the page in a browser should display a message.

The code is pretty simple, but let us explain the last line in more detail. The
browser tries to execute the javascript code in `app.js` as quickly as possible,
and it could happen that the DOM is not ready yet when we try to mount the `App`
component. To avoid this situation, we use the [`whenReady`](../reference/utils.md#whenready)
helper to delay the execution of the `setup` function until the DOM is ready.

Note 1: in a larger project, we would split the code in multiple files, with
components in a sub folder, and a main file that would initialize the application.
However, this is a very small project, and we want to keep it as simple as possible.

Note 2: this tutorial uses the static class field syntax. This is not yet
supported by all browsers. Most real projects will transpile their code, so this
is not a problem, but for this tutorial, if you need the code to work on every
browser, you will need to translate each `static` keyword to an assignation to
the class:

```js
class App extends Component {}
App.template = xml`<div>todo app</div>`;
```

Note 3: writing inline templates with the [`xml` helper](../reference/tags.md#xml-tag)
is nice, but there is no syntax highlighting, and this makes it very easy to
have malformed xml. Some editors support syntax highlighting for this situation.
For example, VS Code has an addon `Comment tagged template`, which, if installed,
will properly display tagged templates:

```js
    static template = xml /* xml */`<div>todo app</div>`;
```

Note 4: Large applications will probably want to be able to translate templates.
Using inline templates makes it slightly harder, since we need additional tooling
to extract the xml from the code, and to replace it with the translated values.

## 3. Displaying a list of tasks

Now that the basics are done, it is time to start thinking about tasks. To
accomplish what we need, we will keep track of the tasks as an array of objects
with the following keys:

- `id`: a number. It is extremely useful to have a way to uniquely identify
  tasks. Since the title is something created/edited by the user, it offers
  no guarantee that it is unique. So, we will generate a unique `id` number for
  each task.
- `title`: a string, to explain what the task is about.
- `isCompleted`: a boolean, to keep track of the status of the task

Now that we decided on the internal format of the state, let us add some demo
data and a template to the `App` component:

```js
class App extends Component {
  static template = xml/* xml */ `
    <div class="task-list">
        <t t-foreach="tasks" t-as="task" t-key="task.id">
            <div class="task">
                <input type="checkbox" t-att-checked="task.isCompleted"/>
                <span><t t-esc="task.title"/></span>
            </div>
        </t>
    </div>`;

  tasks = [
    {
      id: 1,
      title: "buy milk",
      isCompleted: true
    },
    {
      id: 2,
      title: "clean house",
      isCompleted: false
    }
  ];
}
```

The template contains a [`t-foreach`](../reference/qweb_templating_language.md#loops) loop to iterate
through the tasks. It can find the `tasks` list from the component, since the
component is the rendering context. Note that we use the `id` of each task as a
`t-key`, which is very common. There are two css classes: `task-list` and `task`,
that we will use in the next section.

Finally, notice the use of the `t-att-checked` attribute:
prefixing an attribute by [`t-att`](../reference/qweb_templating_language.md#dynamic-attributes) makes
it dynamic. Owl will evaluate the expression and set it as the value of the
attribute.

## 4. Layout: some basic css

So far, our task list looks quite bad. Let us add the following to `app.css`:

```css
.task-list {
  width: 300px;
  margin: 50px auto;
  background: aliceblue;
  padding: 10px;
}

.task {
  font-size: 18px;
  color: #111111;
}
```

This is better. Now, let us add an extra feature: completed tasks should be
styled a little differently, to make it clearer that they are not as important.
To do that, we will add a dynamic css class on each task:

```xml
    <div class="task" t-att-class="task.isCompleted ? 'done' : ''">
```

```css
.task.done {
  opacity: 0.7;
}
```

Notice that we have here another use of a dynamic attribute.

## 5. Extracting Task as a subcomponent

It is now clear that there should be a `Task` component to encapsulate the look
and behavior of a task.

This `Task` component will display a task, but it cannot _own_ the state of the
task: a piece of data should only have one owner. Doing otherwise is asking for
trouble. So, the `Task` component will get its data as a `prop`. This means that
the data is still owned by the `App` component, but can be used by the `Task`
component (without modifying it).

Since we are moving code around, it is a good opportunity to refactor the code
a little bit:

```js
// -------------------------------------------------------------------------
// Task Component
// -------------------------------------------------------------------------
const TASK_TEMPLATE = xml /* xml */`
    <div class="task" t-att-class="props.task.isCompleted ? 'done' : ''">
        <input type="checkbox" t-att-checked="props.task.isCompleted"/>
        <span><t t-esc="props.task.title"/></span>
    </div>`;

class Task extends Component {
    static template = TASK_TEMPLATE;
    static props = ["task"];
}

// -------------------------------------------------------------------------
// App Component
// -------------------------------------------------------------------------
const APP_TEMPLATE = xml /* xml */`
    <div class="task-list">
        <t t-foreach="tasks" t-as="task" t-key="task.id">
            <Task task="task"/>
        </t>
    </div>`;

class App extends Component {
    static template = APP_TEMPLATE;
    static components = { Task };

    tasks = [
        ...
    ];
}

// -------------------------------------------------------------------------
// Setup code
// -------------------------------------------------------------------------
function setup() {
    owl.config.mode = "dev";
    const app = new App();
    app.mount(document.body);
}

whenReady(setup);
```

A lot of stuff happened here:

- first, we have now a sub component `Task`, defined on top of the file,
- whenever we define a sub component, it needs to be added to the static
  [`components`](../reference/component.md#static-properties)
  key of its parent, so Owl can get a reference to it,
- the templates have been extracted out of the components, to make it easier to
  differentiate the "view/template" code from the "script/behavior" code,
- the `Task` component has a `props` key: this is only useful for validation
  purpose. It says that each `Task` should be given exactly one prop, named
  `task`. If this is not the case, Owl will throw an
  [error](../reference/props_validation.md). This is extremely
  useful when refactoring components
- finally, to activate the props validation, we need to set Owl's
  [mode](../reference/config.md#mode) to `dev`. This is done in the `setup`
  function. Note that this should be removed when an app is used in a real
  production environment, since `dev` mode is slightly slower, due to extra
  checks and validations.

## 6. Adding tasks (part 1)

We still use a list of hardcoded tasks. It's really time to give the user a way
to add tasks himself. The first step is to add an input to the `App` component.
But this input will be outside of the task list, so we need to adapt `App`
template, js, and css:

```xml
<div class="todo-app">
    <input placeholder="Enter a new task" t-on-keyup="addTask"/>
    <div class="task-list">
        <t t-foreach="tasks" t-as="task" t-key="task.id">
            <Task task="task"/>
        </t>
    </div>
</div>
```

```js
addTask(ev) {
    // 13 is keycode for ENTER
    if (ev.keyCode === 13) {
        const title = ev.target.value.trim();
        ev.target.value = "";
        console.log('adding task', title);
        // todo
    }
}
```

```css
.todo-app {
  width: 300px;
  margin: 50px auto;
  background: aliceblue;
  padding: 10px;
}

.todo-app > input {
  display: block;
  margin: auto;
}

.task-list {
  margin-top: 8px;
}
```

We now have a working input, which log to the console whenever the user adds a
task. Notice that when you load the page, the input is not focused. But adding
tasks is a core feature of a task list, so let us make it as fast as possible by
focusing the input.

Since `App` is a component, it has a
[`mounted` lifecycle method](../reference/component.md#lifecycle) that we can
implement. We will also need to get a reference to the input, by using the
`t-ref` directive with the [`useRef`](../reference/hooks.md#useref) hook:

```xml
<input placeholder="Enter a new task" t-on-keyup="addTask" t-ref="add-input"/>
```

```js
// on top of file:
const { useRef } = owl.hooks;
```

```js
// in App
inputRef = useRef("add-input");

mounted() {
    this.inputRef.el.focus();
}
```

The `inputRef` is defined as a class field, so it is equivalent to defining it
in the constructor. It simply instructs Owl to keep a reference to anything with
the corresponding `t-ref` keyword. We then implement the `mounted` lifecycle
method, where we now have an active reference that we can use to focus the input.

## 7. Adding tasks (part 2)

In the previous section, we did everything except implement the code that actually
create tasks! So, let us do that now.

We need a way to generate unique `id` numbers. To do that, we will simply add a
`nextId` number in `App`. At the same time, let us remove the demo tasks in `App`:

```js
nextId = 1;
tasks = [];
```

Now, the `addTask` method can be implemented:

```js
addTask(ev) {
    // 13 is keycode for ENTER
    if (ev.keyCode === 13) {
        const title = ev.target.value.trim();
        ev.target.value = "";
        if (title) {
            const newTask = {
                id: this.nextId++,
                title: title,
                isCompleted: false,
            };
            this.tasks.push(newTask);
        }
    }
}
```

This almost works, but if you test it, you will notice that no new task is ever
displayed when the user press `Enter`. But if you add a `debugger` or a
`console.log` statement, you will see that the code is actually running as
expected. The problem is that Owl has no way of knowing that it needs to rerender
the user interface. We can fix the issue by making `tasks` reactive, with the
[`useState`](../reference/hooks.md#usestate) hook:

```js
// on top of the file
const { useRef, useState } = owl.hooks;

// replace the task definition in App with the following:
tasks = useState([]);
```

It now works as expected!

## 8. Toggling tasks

If you tried to mark a task as completed, you may have noticed that the text
did not change in opacity. This is because there is no code to modify the
`isCompleted` flag.

Now, this is an interesting situation: the task is displayed by the `Task`
component, but it is not the owner of its state, so it cannot modify it. Instead,
we want to communicate the request to toggle a task to the `App` component.
Since `App` is a parent of `Task`, we can
[trigger](../reference/event_handling.md) an event in `Task` and listen
for it in `App`.

In `Task`, change the `input` to:

```xml
<input type="checkbox" t-att-checked="props.task.isCompleted" t-on-click="toggleTask"/>
```

and add the `toggleTask` method:

```js
toggleTask() {
    this.trigger('toggle-task', {id: this.props.task.id});
}
```

We now need to listen for that event in the `App` template:

```xml
<div class="task-list" t-on-toggle-task="toggleTask">
```

and implement the `toggleTask` code:

```js
toggleTask(ev) {
    const task = this.tasks.find(t => t.id === ev.detail.id);
    task.isCompleted = !task.isCompleted;
}
```

## 9. Deleting tasks

Let us now add the possibility do delete tasks. To do that, we first need to add
a trash icon on each task, then we will proceed just like in the previous section.

First, let us update the `Task` template, css and js:

```xml
<div class="task" t-att-class="props.task.isCompleted ? 'done' : ''">
    <input type="checkbox" t-att-checked="props.task.isCompleted" t-on-click="toggleTask"/>
    <span><t t-esc="props.task.title"/></span>
    <span class="delete" t-on-click="deleteTask">🗑</span>
</div>
```

```css
.task {
  font-size: 18px;
  color: #111111;
  display: grid;
  grid-template-columns: 30px auto 30px;
}

.task > input {
  margin: auto;
}

.delete {
  opacity: 0;
  cursor: pointer;
  text-align: center;
}

.task:hover .delete {
  opacity: 1;
}
```

```js
deleteTask() {
    this.trigger('delete-task', {id: this.props.task.id});
}
```

And now, we need to listen to the `delete-task` event in `App`:

```xml
<div class="task-list" t-on-toggle-task="toggleTask" t-on-delete-task="deleteTask">
```

```js
deleteTask(ev) {
    const index = this.tasks.findIndex(t => t.id === ev.detail.id);
    this.tasks.splice(index, 1);
}
```

## 10. Using a store

Looking at the code, it is apparent that we now have code to handle tasks
scattered in more than one place. Also, it mixes UI code and business logic
code. Owl has a way to manage state separately from the user interface: a
[`Store`](../reference/store.md).

Let us use it in our application. This is a pretty large refactoring (for our
application), since it involves extracting all task related code out of the
components. Here is the new content of the `app.js` file:

```js
const { Component, Store } = owl;
const { xml } = owl.tags;
const { whenReady } = owl.utils;
const { useRef, useDispatch, useStore } = owl.hooks;

// -------------------------------------------------------------------------
// Store
// -------------------------------------------------------------------------
const actions = {
  addTask({ state }, title) {
    title = title.trim();
    if (title) {
      const task = {
        id: state.nextId++,
        title: title,
        isCompleted: false
      };
      state.tasks.push(task);
    }
  },
  toggleTask({ state }, id) {
    const task = state.tasks.find(t => t.id === id);
    task.isCompleted = !task.isCompleted;
  },
  deleteTask({ state }, id) {
    const index = state.tasks.findIndex(t => t.id === id);
    state.tasks.splice(index, 1);
  }
};
const initialState = {
  nextId: 1,
  tasks: []
};

// -------------------------------------------------------------------------
// Task Component
// -------------------------------------------------------------------------
const TASK_TEMPLATE = xml/* xml */ `
    <div class="task" t-att-class="props.task.isCompleted ? 'done' : ''">
        <input type="checkbox" t-att-checked="props.task.isCompleted"
                t-on-click="dispatch('toggleTask', props.task.id)"/>
        <span><t t-esc="props.task.title"/></span>
        <span class="delete" t-on-click="dispatch('deleteTask', props.task.id)">🗑</span>
    </div>`;

class Task extends Component {
  static template = TASK_TEMPLATE;
  static props = ["task"];
  dispatch = useDispatch();
}

// -------------------------------------------------------------------------
// App Component
// -------------------------------------------------------------------------
const APP_TEMPLATE = xml/* xml */ `
    <div class="todo-app">
        <input placeholder="Enter a new task" t-on-keyup="addTask" t-ref="add-input"/>
        <div class="task-list">
            <t t-foreach="tasks" t-as="task" t-key="task.id">
                <Task task="task"/>
            </t>
        </div>
    </div>`;

class App extends Component {
  static template = APP_TEMPLATE;
  static components = { Task };

  inputRef = useRef("add-input");
  tasks = useStore(state => state.tasks);
  dispatch = useDispatch();

  mounted() {
    this.inputRef.el.focus();
  }

  addTask(ev) {
    // 13 is keycode for ENTER
    if (ev.keyCode === 13) {
      this.dispatch("addTask", ev.target.value);
      ev.target.value = "";
    }
  }
}

// -------------------------------------------------------------------------
// Setup code
// -------------------------------------------------------------------------
function setup() {
  owl.config.mode = "dev";
  const store = new Store({ actions, state: initialState });
  App.env.store = store;
  const app = new App();
  app.mount(document.body);
}

whenReady(setup);
```

## 11-Saving tasks in local storage

Now, our TodoApp works great, except if the user closes or refresh the browser!
It is really inconvenient to only keep the state of the application in memory.
To fix this, we will save the tasks in the local storage. With our current
codebase, it is a simple change: only the setup code needs to be updated.

```js
function makeStore() {
  const localState = window.localStorage.getItem("todoapp");
  const state = localState ? JSON.parse(localState) : initialState;
  const store = new Store({ state, actions });
  store.on("update", null, () => {
    localStorage.setItem("todoapp", JSON.stringify(store.state));
  });
  return store;
}

function setup() {
  owl.config.mode = "dev";
  App.env.store = makeStore();
  const app = new App();
  app.mount(document.body);
}
```

The key point is to use the fact that the store is an
[`EventBus`](../reference/event_bus.md) which triggers an `update` event
whenever it is updated.

## 12. Filtering tasks

We are almost done, we can add/update/delete tasks. The only missing feature is
the possibility to display the task according to their completed status. We will
need to keep track of the state of the filter in `App`, then filter the visible
tasks according to its value.

```js
// on top of file, readd useState:
const { useRef, useDispatch, useState, useStore } = owl.hooks;

// in App:
filter = useState({value: "all"})

get displayedTasks() {
    switch (this.filter.value) {
        case "active": return this.tasks.filter(t => !t.isCompleted);
        case "completed": return this.tasks.filter(t => t.isCompleted);
        case "all": return this.tasks;
    }
}

setFilter(filter) {
    this.filter.value = filter;
}
```

Finally, we need to display the visible filters. We can do that, and at the
same time, display the number of tasks in a small panel below the main list:

```xml
<div class="todo-app">
    <input placeholder="Enter a new task" t-on-keyup="addTask" t-ref="add-input"/>
    <div class="task-list">
        <t t-foreach="displayedTasks" t-as="task" t-key="task.id">
            <Task task="task"/>
        </t>
    </div>
    <div class="task-panel" t-if="tasks.length">
        <div class="task-counter">
            <t t-esc="displayedTasks.length"/>
            <t t-if="displayedTasks.length lt tasks.length">
                / <t t-esc="tasks.length"/>
            </t>
            task(s)
        </div>
        <div>
            <span t-foreach="['all', 'active', 'completed']"
                t-as="f" t-key="f"
                t-att-class="{active: filter.value===f}"
                t-on-click="setFilter(f)"
                t-esc="f"/>
        </div>
    </div>
</div>
```

```css
.task-panel {
  color: #0088ff;
  margin-top: 8px;
  font-size: 14px;
  display: flex;
}

.task-panel .task-counter {
  flex-grow: 1;
}

.task-panel span {
  padding: 5px;
  cursor: pointer;
}

.task-panel span.active {
  font-weight: bold;
}
```

Notice here that we set dynamically the class of the filter with the object
syntax: each key is a class that we want to set if its value is truthy.

## 13. The Final Touch

Our list is feature complete. We can still add a few extra details to improve
the user experience.

1. Add a visual feedback when the user mouse is over a task:

```css
.task:hover {
  background-color: #def0ff;
}
```

2. Make the title of a task clickable, to toggle its checkbox:

```xml
<input type="checkbox" t-att-checked="props.task.isCompleted"
    t-att-id="props.task.id"
    t-on-click="dispatch('toggleTask', props.task.id)"/>
<label t-att-for="props.task.id"><t t-esc="props.task.title"/></label>
```

3. Strike the title of completed task:

```css
.task.done label {
  text-decoration: line-through;
}
```

## Final code

Our application is now complete. It works, the UI code is well separated from
the business logic code, it is testable, all under 150 lines of code (template
included!).

For reference, here is the final code:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>OWL Todo App</title>
    <link rel="stylesheet" href="app.css" />
    <script src="owl.js"></script>
    <script src="app.js"></script>
  </head>
  <body></body>
</html>
```

```js
(function() {
  const { Component, Store } = owl;
  const { xml } = owl.tags;
  const { whenReady } = owl.utils;
  const { useRef, useDispatch, useState, useStore } = owl.hooks;

  // -------------------------------------------------------------------------
  // Store
  // -------------------------------------------------------------------------
  const actions = {
    addTask({ state }, title) {
      title = title.trim();
      if (title) {
        const task = {
          id: state.nextId++,
          title: title,
          isCompleted: false
        };
        state.tasks.push(task);
      }
    },
    toggleTask({ state }, id) {
      const task = state.tasks.find(t => t.id === id);
      task.isCompleted = !task.isCompleted;
    },
    deleteTask({ state }, id) {
      const index = state.tasks.findIndex(t => t.id === id);
      state.tasks.splice(index, 1);
    }
  };

  const initialState = {
    nextId: 1,
    tasks: []
  };

  // -------------------------------------------------------------------------
  // Task Component
  // -------------------------------------------------------------------------
  const TASK_TEMPLATE = xml/* xml */ `
    <div class="task" t-att-class="props.task.isCompleted ? 'done' : ''">
        <input type="checkbox" t-att-checked="props.task.isCompleted"
            t-att-id="props.task.id"
            t-on-click="dispatch('toggleTask', props.task.id)"/>
        <label t-att-for="props.task.id"><t t-esc="props.task.title"/></label>
        <span class="delete" t-on-click="dispatch('deleteTask', props.task.id)">🗑</span>
    </div>`;

  class Task extends Component {
    static template = TASK_TEMPLATE;
    static props = ["task"];
    dispatch = useDispatch();
  }

  // -------------------------------------------------------------------------
  // App Component
  // -------------------------------------------------------------------------
  const APP_TEMPLATE = xml/* xml */ `
    <div class="todo-app">
        <input placeholder="Enter a new task" t-on-keyup="addTask" t-ref="add-input"/>
        <div class="task-list">
            <Task t-foreach="displayedTasks" t-as="task" t-key="task.id" task="task"/>
        </div>
        <div class="task-panel" t-if="tasks.length">
            <div class="task-counter">
                <t t-esc="displayedTasks.length"/>
                <t t-if="displayedTasks.length lt tasks.length">
                    / <t t-esc="tasks.length"/>
                </t>
                task(s)
            </div>
            <div>
                <span t-foreach="['all', 'active', 'completed']"
                    t-as="f" t-key="f"
                    t-att-class="{active: filter.value===f}"
                    t-on-click="setFilter(f)"
                    t-esc="f"/>
            </div>
        </div>
    </div>`;

  class App extends Component {
    static template = APP_TEMPLATE;
    static components = { Task };

    inputRef = useRef("add-input");
    tasks = useStore(state => state.tasks);
    filter = useState({ value: "all" });
    dispatch = useDispatch();

    mounted() {
      this.inputRef.el.focus();
    }

    addTask(ev) {
      // 13 is keycode for ENTER
      if (ev.keyCode === 13) {
        this.dispatch("addTask", ev.target.value);
        ev.target.value = "";
      }
    }

    get displayedTasks() {
      switch (this.filter.value) {
        case "active":
          return this.tasks.filter(t => !t.isCompleted);
        case "completed":
          return this.tasks.filter(t => t.isCompleted);
        case "all":
          return this.tasks;
      }
    }
    setFilter(filter) {
      this.filter.value = filter;
    }
  }

  // -------------------------------------------------------------------------
  // Setup code
  // -------------------------------------------------------------------------
  function makeStore() {
    const localState = window.localStorage.getItem("todoapp");
    const state = localState ? JSON.parse(localState) : initialState;
    const store = new Store({ state, actions });
    store.on("update", null, () => {
      localStorage.setItem("todoapp", JSON.stringify(store.state));
    });
    return store;
  }

  function setup() {
    owl.config.mode = "dev";
    App.env.store = makeStore();
    const app = new App();
    app.mount(document.body);
  }

  whenReady(setup);
})();
```

```css
.todo-app {
  width: 300px;
  margin: 50px auto;
  background: aliceblue;
  padding: 10px;
}

.todo-app > input {
  display: block;
  margin: auto;
}

.task-list {
  margin-top: 8px;
}

.task {
  font-size: 18px;
  color: #111111;
  display: grid;
  grid-template-columns: 30px auto 30px;
}

.task:hover {
  background-color: #def0ff;
}

.task > input {
  margin: auto;
}

.delete {
  opacity: 0;
  cursor: pointer;
  text-align: center;
}

.task:hover .delete {
  opacity: 1;
}

.task.done {
  opacity: 0.7;
}
.task.done label {
  text-decoration: line-through;
}

.task-panel {
  color: #0088ff;
  margin-top: 8px;
  font-size: 14px;
  display: flex;
}

.task-panel .task-counter {
  flex-grow: 1;
}

.task-panel span {
  padding: 5px;
  cursor: pointer;
}

.task-panel span.active {
  font-weight: bold;
}
```
