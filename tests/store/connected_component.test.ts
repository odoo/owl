import { core } from "../../src";
import { Component, Env } from "../../src/component/component";
import { ConnectedComponent } from "../../src/store/connected_component";
import { Store } from "../../src/store/store";
import { makeTestEnv, makeTestFixture, nextTick } from "../helpers";

const Observer = core.Observer;

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
                <t t-foreach="props.todos" t-as="todo" >
                    <Todo msg="todo.msg" t-key="todo"/>
                </t>
            </div>
            <span t-name="Todo"><t t-esc="props.msg"/></span>
        </templates>
    `);
    class App extends ConnectedComponent<any, any, any> {
      components = { Todo };
      static mapStoreToProps(s) {
        return { todos: s.todos };
      }
    }
    class Todo extends Component<any, any, any> {}
    const state = { todos: [] };
    const mutations = {
      addTodo({ state }, msg) {
        state.todos.push({ msg });
      }
    };
    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toMatchSnapshot();

    store.commit("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });

  test("deep and shallow connecting a component", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="App">
                <span t-foreach="props.todos" t-as="todo" t-key="todo">
                  <t t-esc="todo.title"/>
                </span>
            </div>
        </templates>
    `);
    const state = { todos: [{ title: "Kasteel" }] };
    const mutations = {
      edit({ state }, title) {
        state.todos[0].title = title;
      }
    };
    const store = new Store({ state, mutations });

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

    store.commit("edit", "Bertinchamps");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
    expect(shallowFix.innerHTML).toMatchSnapshot();
  });

  test("connecting a component to a local store", async () => {
    env.qweb.addTemplates(`
      <templates>
        <div t-name="App">
          <t t-foreach="props.todos" t-as="todo">
            <Todo msg="todo.msg" t-key="todo" />
          </t>
        </div>
        <span t-name="Todo"><t t-esc="props.msg"/></span>
      </templates>
      `);
    class Todo extends Component<any, any, any> {}

    (<any>env).store = new Store({});
    const store = new Store({
      state: { todos: [] },
      mutations: {
        addTodo({ state }, msg) {
          state.todos.push({ msg });
        }
      }
    });
    class App extends ConnectedComponent<any, any, any> {
      components = { Todo };
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

    (<any>app.__owl__).store.commit("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
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
      components = { Child };

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
    const mutations = {
      addTodo({ state }, text) {
        state.todos.push({ text, id: nextId++ });
      }
    };
    const store = new Store({ state, mutations });

    env.qweb.addTemplates(`
        <templates>
            <span t-name="TodoItem"><t t-esc="props.text"/></span>
            <div t-name="TodoList">
                <t t-foreach="props.todos" t-as="todo">
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
      components = { TodoItem };
      static mapStoreToProps(state) {
        return { todos: state.todos };
      }
    }

    (<any>env).store = store;
    const app = new TodoList(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.commit("addTodo", "hoegaarden");
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
                <span><t t-esc="props.activeTodoText"/></span>
                <span><t t-esc="props.importantTodoText"/></span>
            </div>
            <div t-name="TodoList">
                <t t-foreach="props.todos" t-as="todo">
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
      components = { TodoItem };
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
            <span t-name="Beer"><t t-esc="props.name"/></span>
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
      components = { Beer };
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
              <span t-foreach="props.beers" t-as="beer" t-key="beer.name"><t t-esc="beer.name"/></span>
          </div>
        </templates>
    `);

    class App extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(state) {
        return { beers: state.beers, otherKey: 1 };
      }
    }

    const mutations = {
      addBeer({ state }, name) {
        state.beers.push({ name });
      }
    };

    const state = { beers: [{ name: "jupiler" }] };
    const store = new Store({ state, mutations });
    (<any>env).store = store;

    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.commit("addBeer", "kwak");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span><span>kwak</span></div>");
  });

  test("connected component with undefined, null and string props", async () => {
    env.qweb.addTemplates(`
        <templates>
            <div t-name="Beer">
                <span>taster:<t t-esc="props.taster"/></span>
                <span t-if="props.selected">selected:<t t-esc="props.selected.name"/></span>
                <span t-if="props.consumed">consumed:<t t-esc="props.consumed.name"/></span>
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
      components = { Beer };
      state = { beerId: 0 };
    }

    const mutations = {
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
    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>taster:aaron</span></div></div>");

    app.state.beerId = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span></div></div>"
    );

    store.commit("consume", 1);
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
                <span>taster:<t t-esc="props.taster"/></span>
                <span t-if="props.selected">selected:<t t-esc="props.selected.name"/></span>
                <span t-if="props.consumed">consumed:<t t-esc="props.consumed.name"/></span>
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
      components = { Beer };
      state = { beerId: 0 };
    }

    const mutations = {
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
    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div><span>taster:aaron</span></div></div>");

    app.state.beerId = 1;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:jupiler</span></div></div>"
    );

    store.commit("renameBeer", { beerId: 1, name: "kwak" });
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:kwak</span></div></div>"
    );

    store.commit("consume", 1);
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>selected:kwak</span><span>consumed:kwak</span></div></div>"
    );

    app.state.beerId = 0;
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:kwak</span></div></div>"
    );

    store.commit("renameBeer", { beerId: 1, name: "jupiler" });
    await nextTick();
    expect(fixture.innerHTML).toBe(
      "<div><div><span>taster:aaron</span><span>consumed:jupiler</span></div></div>"
    );

    store.commit("changeTaster", "matthieu");
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
                <Child key="props.current"/>
            </div>
            <span t-name="Child"><t t-esc="props.msg"/></span>
        </templates>
    `);

    class Parent extends ConnectedComponent<any, any, any> {
      components = { Child };
      static mapStoreToProps(s) {
        steps.push("parent");
        return { current: s.current, isvisible: s.isvisible };
      }
    }

    class Child extends ConnectedComponent<any, any, any> {
      static mapStoreToProps(s, props) {
        steps.push("child");
        return { msg: s.msg[props.key] };
      }
    }

    const state = { current: "a", msg: { a: "a", b: "b" } };
    const mutations = {
      setCurrent({ state }, c) {
        state.current = c;
      }
    };

    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new Parent(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>a</span></div>");
    expect(steps).toEqual(["parent", "child"]);

    store.commit("setCurrent", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>b</span></div>");
    expect(steps).toEqual(["parent", "child", "parent", "child"]);
  });

  test("connected parent/children: no double rendering", async () => {
    const mutations = {
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
      mutations
    });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoApp" class="todoapp">
                <t t-foreach="Object.values(props.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>

            <div t-name="TodoItem" class="todo">
                <t t-esc="props.todo.title"/>
                <button class="destroy" t-on-click="editTodo">x</button>
            </div>
        </templates>
    `);

    class TodoApp extends ConnectedComponent<any, any, any> {
      components = { TodoItem };
      static mapStoreToProps(state) {
        return {
          todos: state.todos
        };
      }
    }

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
        this.env.store.commit("editTodo");
      }
      __render(...args) {
        renderCount++;
        return super.__render(...args);
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
    const mutations = {
      removeTodo({ state }) {
        Observer.delete(state.todos, 1);
      }
    };
    const todos = { 1: { id: 1, title: "kikoou" } };
    const state = {
      todos
    };
    const store = new Store({
      state,
      mutations
    });

    env.qweb.addTemplates(`
        <templates>
            <div t-name="TodoApp" class="todoapp">
                <t t-foreach="Object.values(props.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>

            <div t-name="TodoItem" class="todo">
                <t t-esc="props.todo.title"/>
                <button class="destroy" t-on-click="removeTodo">x</button>
            </div>
        </templates>
    `);

    class TodoApp extends ConnectedComponent<any, any, any> {
      components = { TodoItem };
      static mapStoreToProps(state) {
        return {
          todos: state.todos
        };
      }
    }

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
        this.env.store.commit("removeTodo");
      }
      __render(...args) {
        renderCount++;
        return super.__render(...args);
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
            <div t-name="App"><t t-esc="props.msg"/></div>
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
    const mutations = {
      setMsg({ state }, c) {
        state.msg = c;
      }
    };

    const store = new Store({ state, mutations });
    (<any>env).store = store;
    const app = new App(env);

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>a</div>");

    store.commit("setMsg", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>b</div>");
    expect(steps).toEqual(["willpatch", "patched"]);
  });
});
