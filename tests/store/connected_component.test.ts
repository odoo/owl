import { Component, Env } from "../../src/component/component";
import { ConnectedComponent } from "../../src/store/connected_component";
import { Store } from "../../src/store/store";
import { makeTestEnv, makeTestFixture, nextTick, makeDeferred } from "../helpers";

describe("connecting a component to store", () => {
  let fixture: HTMLElement;
  let env: Env;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = makeTestEnv();
  });

  afterEach(() => {
    fixture.remove();
  });

  test("connecting a component works", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <t t-foreach="storeProps.todos" t-as="todo" >
                    <Todo msg="todo.msg" t-key="todo"/>
                </t>
            </div>
            <span t-name="Todo"><t t-esc="props.msg"/></span>
        </templates>
    `);
    class Todo extends Component<any, any, any> {}
    class App extends ConnectedComponent<any, any, any> {
      static components = { Todo };
      static mapStoreToProps(s) {
        return { todos: s.todos };
      }
    }
    const state = { todos: [] };
    const actions = {
      addTodo({ state }, msg) {
        state.todos.push({ msg });
      }
    };
    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toMatchSnapshot();

    store.dispatch("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });

  test("deep and shallow connecting a component", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <span t-foreach="storeProps.todos" t-as="todo" t-key="todo">
                  <t t-esc="todo.title"/>
                </span>
            </div>
        </templates>
    `);
    const state = { todos: [{ title: "Kasteel" }] };
    const actions = {
      edit({ state }, title) {
        state.todos[0].title = title;
      }
    };
    const store = new Store({ state, actions });

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return { todos: s.todos };
      }
    }
    class DeepTodoApp extends App {
      deep = true;
    }
    class ShallowTodoApp extends App {
      deep = false;
    }

    (<any>env).store = store;
    const deepTodoApp = new DeepTodoApp(env);
    const shallowTodoApp = new ShallowTodoApp(env);

    await deepTodoApp.mount(fixture);

    const shallowFix = makeTestFixture();
    await shallowTodoApp.mount(shallowFix);

    expect(fixture.innerHTML).toMatchSnapshot();
    expect(shallowFix.innerHTML).toMatchSnapshot();

    store.dispatch("edit", "Bertinchamps");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
    expect(shallowFix.innerHTML).toMatchSnapshot();
  });

  test("connecting a component to a local store", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="App">
          <t t-foreach="storeProps.todos" t-as="todo">
            <Todo msg="todo.msg" t-key="todo" />
          </t>
        </div>
        <span t-name="Todo"><t t-esc="props.msg"/></span>
      </templates>
      `);
    class Todo extends Component<any, any, any> {}

    const store = new Store({
      state: { todos: [] },
      actions: {
        addTodo({ state }, msg) {
          state.todos.push({ msg });
        }
      }
    });
    class App extends ConnectedComponent<any, any, any> {
      static components = { Todo };
      static mapStoreToProps(s) {
        return { todos: s.todos };
      }
      getStore() {
        return store;
      }
    }
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toMatchSnapshot();

    (<any>app.__owl__).store.dispatch("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });

  test("can dispatch actions from a connected component", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="App">
            <button t-on-click="dispatch('inc')">Inc</button>
            <span><t t-esc="storeProps.value"/></span>
        </div>
      </templates>
      `);

    const store = new Store({
      state: { value: 1 },
      actions: {
        inc({ state }) {
          state.value++;
        }
      }
    });
    (<any>env).store = store;

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return { value: s.value };
      }
    }
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><button>Inc</button><span>1</span></div>");

    const button = (<HTMLElement>app.el).getElementsByTagName("button")[0];
    await button.click();
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><button>Inc</button><span>2</span></div>");
  });

  test("connected child components with custom hooks", async () => {
    let steps: any = [];
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
              <Child t-if="state.child" />
          </div>
          <div t-name="Child"/>
        </templates>
    `);
    class Child extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return s;
      }
      mounted() {
        steps.push("child:mounted");
      }
      willUnmount() {
        steps.push("child:willUnmount");
      }
    }

    class Parent extends Component<any, any, any> {
      static components = { Child };

      constructor(env: Env) {
        super(env);
        this.state = { child: true };
      }
    }

    const store = new Store({ state: {} });
    (<any>env).store = store;
    const parent = new Parent(env);

    await parent.mount(fixture);
    expect(steps).toEqual(["child:mounted"]);

    parent.state.child = false;
    await nextTick();
    expect(steps).toEqual(["child:mounted", "child:willUnmount"]);
  });

  test("mapStoreToProps receives ownprops as second argument", async () => {
    const state = { todos: [{ id: 1, text: "jupiler" }] };
    let nextId = 2;
    const actions = {
      addTodo({ state }, text) {
        state.todos.push({ text, id: nextId++ });
      }
    };
    const store = new Store({ state, actions });

    env.qweb.addTemplates(`
        <templates>
            <span t-name="TodoItem"><t t-esc="storeProps.text"/></span>
            <div t-name="TodoList">
                <t t-foreach="storeProps.todos" t-as="todo">
                    <TodoItem id="todo.id" t-key="todo.id"/>
                </t>
          </div>
        </templates>
    `);
    class TodoItem extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props) {
        const todo = state.todos.find(t => t.id === props.id);
        return todo;
      }
    }

    class TodoList extends ConnectedComponent<any, any, any> {
      static components = { TodoItem };
      static mapStoreToProps(state) {
        return { todos: state.todos };
      }
    }

    (<any>env).store = store;
    const app = new TodoList(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.dispatch("addTodo", "hoegaarden");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span><span>hoegaarden</span></div>");
  });

  test("mapStoreToProps receives store getters as third argument", async () => {
    const state = {
      importantID: 1,
      todos: [{ id: 1, text: "jupiler" }, { id: 2, text: "bertinchamps" }]
    };
    const getters = {
      importantTodoText({ state }) {
        return state.todos.find(todo => todo.id === state.importantID).text;
      },
      text({ state }, id) {
        return state.todos.find(todo => todo.id === id).text;
      }
    };
    const store = new Store({ state, getters });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoItem">
                <span><t t-esc="storeProps.activeTodoText"/></span>
                <span><t t-esc="storeProps.importantTodoText"/></span>
            </div>
            <div t-name="TodoList">
                <t t-foreach="storeProps.todos" t-as="todo">
                    <TodoItem id="todo.id" t-key="todo.id"/>
                </t>
            </div>
        </templates>
    `);

    class TodoItem extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props, getters) {
        const todo = state.todos.find(t => t.id === props.id);
        return {
          activeTodoText: getters.text(todo.id),
          importantTodoText: getters.importantTodoText()
        };
      }
    }

    class TodoList extends ConnectedComponent<any, any, any> {
      static components = { TodoItem };
      static mapStoreToProps(state) {
        return { todos: state.todos };
      }
    }

    (<any>env).store = store;
    const app = new TodoList(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div><span>jupiler</span><span>jupiler</span></div><div><span>bertinchamps</span><span>jupiler</span></div></div>"
    );
  });

  test("connected component is updated when props are updated", async () => {
    env.qweb.addTemplates(`
        <templates>
            <span t-name="Beer"><t t-esc="storeProps.name"/></span>
            <div t-name="App">
                <Beer id="state.beerId"/>
            </div>
        </templates>
    `);

    class Beer extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props) {
        return state.beers[props.id];
      }
    }

    class App extends Component<any, any, any> {
      static components = { Beer };
      state = { beerId: 1 };
    }

    const state = { beers: { 1: { name: "jupiler" }, 2: { name: "kwak" } } };
    const store = new Store({ state });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    app.state.beerId = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>kwak</span></div>");
  });

  test("connected component is updated when store is changed", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
              <span t-foreach="storeProps.beers" t-as="beer" t-key="beer.name"><t t-esc="beer.name"/></span>
          </div>
        </templates>
    `);

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state) {
        return { beers: state.beers, otherKey: 1 };
      }
    }

    const actions = {
      addBeer({ state }, name) {
        state.beers.push({ name });
      }
    };

    const state = { beers: [{ name: "jupiler" }] };
    const store = new Store({ state, actions });
    (<any>env).store = store;

    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.dispatch("addBeer", "kwak");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span><span>kwak</span></div>");
  });

  test("connected component with undefined, null and string props", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Beer">
                <span>taster:<t t-esc="storeProps.taster"/></span>
                <span t-if="storeProps.selected">selected:<t t-esc="storeProps.selected.name"/></span>
                <span t-if="storeProps.consumed">consumed:<t t-esc="storeProps.consumed.name"/></span>
            </div>
            <div t-name="App">
               <Beer id="state.beerId"/>
          </div>
        </templates>
    `);

    class Beer extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, props) {
        return {
          selected: state.beers[props.id],
          consumed: state.beers[state.consumedID] || null,
          taster: state.taster
        };
      }
    }

    class App extends Component<any, any, any> {
      static components = { Beer };
      state = { beerId: 0 };
    }

    const actions = {
      consume({ state }, beerId) {
        state.consumedID = beerId;
      }
    };
    const state = {
      beers: {
        1: { name: "jupiler" }
      },
      consumedID: null,
      taster: "aaron"
    };
    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>taster:aaron</span></div></div>");

    app.state.beerId = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span></div></div>"
    );

    store.dispatch("consume", 1);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span><span>consumed:jupiler</span></div></div>"
    );

    app.state.beerId = 0;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:jupiler</span></div></div>"
    );
  });

  test("connected component deeply reactive with undefined, null and string props", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Beer">
                <span>taster:<t t-esc="storeProps.taster"/></span>
                <span t-if="storeProps.selected">selected:<t t-esc="storeProps.selected.name"/></span>
                <span t-if="storeProps.consumed">consumed:<t t-esc="storeProps.consumed.name"/></span>
            </div>
            <div t-name="App">
               <Beer id="state.beerId"/>
          </div>
        </templates>
    `);

    class Beer extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(storeState, props) {
        return {
          selected: storeState.beers[props.id],
          consumed: storeState.beers[storeState.consumedID] || null,
          taster: storeState.taster
        };
      }
    }

    class App extends Component<any, any, any> {
      static components = { Beer };
      state = { beerId: 0 };
    }

    const actions = {
      changeTaster({ state }, newTaster) {
        state.taster = newTaster;
      },
      consume({ state }, beerId) {
        state.consumedID = beerId;
      },
      renameBeer({ state }, { beerId, name }) {
        state.beers[beerId].name = name;
      }
    };
    const state = {
      beers: {
        1: { name: "jupiler" }
      },
      consumedID: null,
      taster: "aaron"
    };
    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>taster:aaron</span></div></div>");

    app.state.beerId = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span></div></div>"
    );

    store.dispatch("renameBeer", { beerId: 1, name: "kwak" });
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:kwak</span></div></div>"
    );

    store.dispatch("consume", 1);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:kwak</span><span>consumed:kwak</span></div></div>"
    );

    app.state.beerId = 0;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:kwak</span></div></div>"
    );

    store.dispatch("renameBeer", { beerId: 1, name: "jupiler" });
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:jupiler</span></div></div>"
    );

    store.dispatch("changeTaster", "matthieu");
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:matthieu</span><span>consumed:jupiler</span></div></div>"
    );
  });

  test("correct update order when parent/children are connected", async () => {
    const steps: string[] = [];

    env.qweb.addTemplates(`
        <templates>
            <div t-name="Parent">
                <Child key="storeProps.current"/>
            </div>
            <span t-name="Child"><t t-esc="storeProps.msg"/></span>
        </templates>
    `);

    class Child extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s, props) {
        steps.push("child");
        return { msg: s.msg[props.key] };
      }
    }
    class Parent extends ConnectedComponent<any, any, any> {
      static components = { Child };
      static mapStoreToProps(s) {
        steps.push("parent");
        return { current: s.current, isvisible: s.isvisible };
      }
    }

    const state = { current: "a", msg: { a: "a", b: "b" } };
    const actions = {
      setCurrent({ state }, c) {
        state.current = c;
      }
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new Parent(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>a</span></div>");
    expect(steps).toEqual(["parent", "child"]);

    store.dispatch("setCurrent", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>b</span></div>");
    expect(steps).toEqual(["parent", "child", "parent", "child"]);
  });

  test("correct update order when parent/children are connectedddd", async () => {
    const steps: string[] = [];
    let def = makeDeferred();
    def.resolve();

    env.qweb.addTemplates(`
        <templates>
            <div t-name="Parent">
                <Child t-if="storeProps.flag" someId="storeProps.someId"/>
            </div>
            <span t-name="Child"><t t-esc="storeProps.msg"/></span>
        </templates>
    `);

    class Child extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s, props) {
        steps.push("child");
        return { msg: s.messages[props.someId] };
      }
    }
    class Parent extends ConnectedComponent<any, any, any> {
      static components = { Child };
      static mapStoreToProps(s) {
        steps.push("parent");
        return { flag: s.flag, someId: s.someId };
      }
      async render(force) {
        await def;
        return super.render(force);
      }
    }

    const state = { someId: 1, flag: true, messages: { 1: "abc" } };
    const actions = {
      setFlagToFalse({ state }) {
        state.flag = false;
      }
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new Parent(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>abc</span></div>");
    expect(steps).toEqual(["parent", "child"]);

    def = makeDeferred();
    store.dispatch("setFlagToFalse");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>abc</span></div>");
    expect(steps).toEqual(["parent", "child", "parent"]);

    def.resolve();
    await nextTick();
    expect(steps).toEqual(["parent", "child", "parent"]);
    expect(fixture.innerHTML).toBe("<div></div>");
  });

  test("connected parent/children: no double rendering", async () => {
    const actions = {
      editTodo({ state }) {
        state.todos[1].title = "abc";
      }
    };
    const todos = { 1: { id: 1, title: "kikoou" } };
    const state = {
      todos
    };
    const store = new Store({
      state,
      actions
    });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoApp" class="todoapp">
                <t t-foreach="Object.values(storeProps.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>

            <div t-name="TodoItem" class="todo">
                <t t-esc="storeProps.todo.title"/>
                <button class="destroy" t-on-click="editTodo">x</button>
            </div>
        </templates>
    `);

    let renderCount = 0;
    let fCount = 0;

    class TodoItem extends ConnectedComponent<any, any, any> {
      state = { isEditing: false };
      static mapStoreToProps(state, ownProps) {
        fCount++;
        return {
          todo: state.todos[ownProps.id]
        };
      }

      editTodo() {
        this.env.store.dispatch("editTodo");
      }
      __render(f) {
        renderCount++;
        return super.__render(f);
      }
    }
    class TodoApp extends ConnectedComponent<any, any, any> {
      static components = { TodoItem };
      static mapStoreToProps(state) {
        return {
          todos: state.todos
        };
      }
    }

    (<any>env).store = store;
    const app = new TodoApp(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">kikoou<button class="destroy">x</button></div></div>'
    );

    expect(renderCount).toBe(1);
    expect(fCount).toBe(1);
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(renderCount).toBe(2);
    expect(fCount).toBe(2);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">abc<button class="destroy">x</button></div></div>'
    );
  });

  test("connected parent/children: no rendering if child is destroyed", async () => {
    const actions = {
      removeTodo({ state }) {
        delete state.todos[1];
      }
    };
    const todos = { 1: { id: 1, title: "kikoou" } };
    const state = {
      todos
    };
    const store = new Store({
      state,
      actions
    });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoApp" class="todoapp">
                <t t-foreach="Object.values(storeProps.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>

            <div t-name="TodoItem" class="todo">
                <t t-esc="storeProps.todo.title"/>
                <button class="destroy" t-on-click="removeTodo">x</button>
            </div>
        </templates>
    `);

    let renderCount = 0;
    let fCount = 0;

    class TodoItem extends ConnectedComponent<any, any, any> {
      state = { isEditing: false };

      static mapStoreToProps(state, ownProps) {
        fCount++;
        return {
          todo: state.todos[ownProps.id]
        };
      }
      removeTodo() {
        this.env.store.dispatch("removeTodo");
      }
      __render(f) {
        renderCount++;
        return super.__render(f);
      }
    }

    class TodoApp extends ConnectedComponent<any, any, any> {
      static components = { TodoItem };
      static mapStoreToProps(state) {
        return {
          todos: state.todos
        };
      }
    }

    (<any>env).store = store;
    const app = new TodoApp(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">kikoou<button class="destroy">x</button></div></div>'
    );

    expect(renderCount).toBe(1);
    expect(fCount).toBe(1);
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(renderCount).toBe(1);
    expect(fCount).toBe(1);
    expect(fixture.innerHTML).toBe('<div class="todoapp"></div>');
  });

  test("connected component willpatch/patch hooks are called on store updates", async () => {
    const steps: string[] = [];

    env.qweb.addTemplates(`
        <templates>
            <div t-name="App"><t t-esc="storeProps.msg"/></div>
        </templates>
    `);

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return { msg: s.msg };
      }
      willPatch() {
        steps.push("willpatch");
      }
      patched() {
        steps.push("patched");
      }
    }

    const state = { msg: "a" };
    const actions = {
      setMsg({ state }, c) {
        state.msg = c;
      }
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>a</div>");

    store.dispatch("setMsg", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>b</div>");
    expect(steps).toEqual(["willpatch", "patched"]);
  });
});

describe("connected components and default values", () => {
  let fixture: HTMLElement;
  let env: Env;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = makeTestEnv();
  });

  afterEach(() => {
    fixture.remove();
  });

  test("can set default values", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Greeter">Hello, <t t-esc="props.recipient"/></div>
            <div t-name="App"><Greeter/></div>
        </templates>
    `);

    class Greeter extends ConnectedComponent<any, any, any> {
      static defaultProps = { recipient: "John" };
    }

    class App extends Component<any, any, any> {
      static components = { Greeter };
    }

    const store = new Store({ state: {} });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>Hello, John</div></div>");
  });

  test("can set default values", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Greeter">Hello, <t t-esc="props.recipient"/></div>
            <div t-name="App"><Greeter recipient="props.initialRecipient"/></div>
        </templates>
    `);

    class Greeter extends ConnectedComponent<any, any, any> {
      static defaultProps = { recipient: "John" };
    }

    class App extends Component<any, any, any> {
      static components = { Greeter };
    }

    const store = new Store({ state: {} });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>Hello, John</div></div>");

    const fiber = app.__createFiber(true, undefined, undefined, undefined);
    await app.__updateProps({ initialRecipient: "James" }, fiber);
    await app.render();
    expect(fixture.innerHTML).toBe("<div><div>Hello, James</div></div>");

    await app.__updateProps({ initialRecipient: undefined }, fiber);
    await app.render();
    expect(fixture.innerHTML).toBe("<div><div>Hello, John</div></div>");
  });

  test("can set default values (v2)", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Message">
                <t t-if="props.showId"><t t-esc="props.messageId"/></t>
                <t t-esc="storeProps.message.content"/>
            </div>
            <div t-name="Thread">
                <t t-if="props.showMessages">
                    <Message t-foreach="storeProps.thread.messages" t-as="messageId" messageId="messageId" t-key="messageId"/>
                </t>
            </div>
            <div t-name="App"><Thread threadId="props.threadId"/></div>
        </templates>
    `);

    class Message extends ConnectedComponent<any, any, any> {
      static defaultProps = { showId: true };
      static mapStoreToProps = function(state, ownProps) {
        return {
          message: state.messages[ownProps.messageId]
        };
      };
    }

    class Thread extends ConnectedComponent<any, any, any> {
      static components = { Message };
      static defaultProps = { showMessages: true };
      static mapStoreToProps = function(state, ownProps) {
        const thread = state.threads[ownProps.threadId];
        return {
          thread
        };
      };
    }

    class App extends Component<any, any, any> {
      static components = { Thread };
      static defaultProps = { threadId: 1 };
    }

    const state = {
      threads: {
        1: {
          messages: [100, 101]
        },
        2: {
          messages: [200]
        }
      },
      messages: {
        100: {
          content: "Message100"
        },
        101: {
          content: "Message101"
        },
        200: {
          content: "Message200"
        }
      }
    };

    const actions = {
      changeMessageContent({ state }, messageId, newContent) {
        state.messages[messageId].content = newContent;
      }
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div><div>100Message100</div><div>101Message101</div></div></div>"
    );

    const fiber = app.__createFiber(true, undefined, undefined, undefined);
    await app.__updateProps({ threadId: 2 }, fiber);
    await app.render();
    expect(fixture.innerHTML).toBe("<div><div><div>200Message200</div></div></div>");

    store.dispatch("changeMessageContent", 200, "UpdatedMessage200");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><div><div>200UpdatedMessage200</div></div></div>");
  });

  test("connected child components stop listening to store when destroyed", async () => {
    let steps: any = [];
    env.qweb.addTemplates(`
        <templates>
          <div t-name="Parent">
              <Child t-if="state.child" />
          </div>
          <div t-name="Child"><t t-esc="storeProps.val"/></div>
        </templates>
    `);
    class Child extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s) {
        return s;
      }
    }

    class Parent extends Component<any, any, any> {
      static components = { Child };
      state = { child: true };
    }

    class TestStore extends Store {
      on(eventType, owner, callback) {
        steps.push(`on:${eventType}`);
        super.on(eventType, owner, callback);
      }
      off(eventType, owner) {
        steps.push(`off:${eventType}`);
        super.off(eventType, owner);
      }
    }
    const store = new TestStore({ state: { val: 1 } });
    (<any>env).store = store;
    const parent = new Parent(env);

    await parent.mount(fixture);
    expect(steps).toEqual(["on:update"]);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");

    parent.state.child = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps).toEqual(["on:update", "off:update"]);
  });

  test("dispatch an action", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="App">
          <t t-esc="storeProps.counter"/>
        </div>
      </templates>
    `);

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps = function(state) {
        return {
          counter: state.counter
        };
      };
    }

    const state = {
      counter: 0
    };

    const actions = {
      inc({ state }) {
        return ++state.counter;
      }
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>0</div>");

    const res = app.dispatch("inc");
    expect(res).toBe(1);
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1</div>");
  });
});

describe("various scenarios", () => {
  let fixture: HTMLElement;
  let env: Env;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = makeTestEnv();
  });

  afterEach(() => {
    fixture.remove();
  });

  test("scenarios with async store updates and some components events", async () => {
    const actions = {
      async deleteAttachment({ state }) {
        await Promise.resolve();
        delete state.attachments[100];
        state.messages[10].attachmentIds = [];
      }
    };
    const state = {
      attachments: {
        100: {
          id: 100,
          name: "text.txt"
        }
      },
      messages: {
        10: {
          attachmentIds: [100],
          id: 10
        }
      }
    };
    const store = new Store({ actions, state });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="Message">
                <button t-on-click="doStuff">Do stuff</button>
                <Attachment t-foreach="storeProps.attachmentIds" t-key="attachmentId" t-as="attachmentId" id="attachmentId"/>
            </div>
            <div t-name="Attachment">
                <span>Attachment <t t-esc="props.id"/></span>
                <span>Name: <t t-esc="storeProps.name"/></span>
            </div>
        </templates>
    `);
    class Attachment extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state, ownProps) {
        return {
          name: state.attachments[ownProps.id].name
        };
      }
    }
    class Message extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state) {
        return {
          attachmentIds: state.messages[10].attachmentIds
        };
      }
      static components = { Attachment };
      state = { isAttachmentDeleted: false };
      doStuff() {
        this.dispatch("deleteAttachment", 100);
        this.state.isAttachmentDeleted = true;
      }
    }

    (<any>env).store = store;
    const message = new Message(env);
    await message.mount(fixture);

    expect(fixture.innerHTML).toMatchSnapshot();

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });
});
