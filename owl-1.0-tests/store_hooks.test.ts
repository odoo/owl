import { Component, Env } from "../src/component/component";
import { Store, useStore, useDispatch, useGetters, EnvWithStore } from "../src/store";
import { useState } from "../src/hooks";
import { xml } from "../src/tags";
import { shallowEqual } from "../src/utils";
import { makeTestEnv, makeTestFixture, nextTick, makeDeferred } from "./helpers";

describe("connecting a component to store", () => {
  let fixture: HTMLElement;
  let env: Env;

  beforeEach(() => {
    fixture = makeTestFixture();
    env = makeTestEnv();
    Component.env = env;
  });

  afterEach(() => {
    fixture.remove();
  });

  test("connecting a component works, with useStore", async () => {
    let nextId = 1;
    const state = { todos: [] };
    const actions = {
      addTodo({ state }, msg) {
        state.todos.push({ msg, id: nextId++ });
      },
    };
    const store = new Store({ state, actions });

    class App extends Component {
      static template = xml`
            <div>
                <span t-foreach="todos" t-key="todo.id" t-as="todo"><t t-esc="todo.msg"/></span>
            </div>`;
      todos = useStore((state) => state.todos);
    }

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");

    await store.dispatch("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");
  });

  test("useStore can observe primitive types and call onUpdate", async () => {
    const state = { isBoolean: false, nullValue: null };
    const actions = {
      setTrue({ state }) {
        state.isBoolean = true;
      },
      setNotNull({ state }) {
        state.nullValue = "ok";
      },
    };
    const store = new Store({ state, actions });

    class App extends Component {
      static template = xml`
            <div>
                <span t-if="isBoolean">ok</span>
                <span t-if="nullValue !== null">not null</span>
            </div>`;
      isBoolean: boolean;
      nullValue: string;
      constructor() {
        super();
        this.isBoolean = useStore((state) => state.isBoolean, {
          onUpdate: (isBoolean) => {
            this.isBoolean = isBoolean;
          },
        });
        this.nullValue = useStore((state) => state.nullValue, {
          onUpdate: (nullValue) => {
            this.nullValue = nullValue;
          },
        });
      }
    }

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");

    store.dispatch("setTrue");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>ok</span></div>");

    store.dispatch("setNotNull");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>ok</span><span>not null</span></div>");
  });

  test("map works on the result of useStore when the resulting array changes for a bigger one", async () => {
    const state = { smallerArray: [1], biggerArray: [2, 3], useSmallArray: true };
    const store = new Store({ state });

    class App extends Component {
      static template = xml`<div t-esc="mapAdd"/>`;
      storeProps = {
        array: useStore((state) => {
          if (state.useSmallArray) {
            return state.smallerArray;
          }
          return state.biggerArray;
        }),
      };
      get mapAdd() {
        return this.storeProps.array.map((a) => {
          return a + 1;
        });
      }
    }

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>2</div>");

    store.state.useSmallArray = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>3,4</div>");
  });

  test("throw error if no store is found", async () => {
    class App extends Component {
      static template = xml`<div></div>`;
      todos = useStore((state) => state.todos);
    }

    let error;
    try {
      new App();
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.message).toBe("No store found when connecting 'App'");
  });

  test("cannot modify state returned by usestore", async () => {
    const state = { a: { b: 1 } };
    const actions = {};
    const store = new Store({ state, actions });

    class App extends Component {
      static template = xml`<div/>`;
      storeState = useStore((state) => state.a);
    }

    (<any>env).store = store;
    const app = new App();
    expect(app.storeState.b).toBe(1);
    expect(() => (app.storeState.b = 2)).toThrow(
      "Store state should only be modified through actions"
    );
  });

  test("can use useStore twice in a component", async () => {
    const state = { a: 1, b: 2 };
    const actions = {
      doSomething({ state }) {
        state.a = 2;
        state.b = 3;
      },
    };
    const store = new Store({ state, actions });

    class App extends Component {
      static template = xml`
            <div>
                <span t-esc="a.value"/>
                <span t-esc="b.value"/>
            </div>`;
      a = useStore((state) => ({ value: state.a }));
      b = useStore((state) => ({ value: state.b }));
    }
    App.prototype.__render = jest.fn(App.prototype.__render);

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>1</span><span>2</span></div>");
    expect(App.prototype.__render).toBeCalledTimes(1);

    await store.dispatch("doSomething");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>2</span><span>3</span></div>");
    expect(App.prototype.__render).toBeCalledTimes(2);
  });

  test("useStore: do not re-render if not changed", async () => {
    let nextId = 1;
    const state = { todos: [], a: 1 };
    const actions = {
      addTodo({ state }, msg) {
        state.todos.push({ msg, id: nextId++ });
      },
    };
    const store = new Store({ state, actions });

    class App extends Component {
      static template = xml`
            <div>
                <span t-foreach="todos" t-key="todo.id" t-as="todo"><t t-esc="todo.msg"/></span>
            </div>`;
      todos = useStore((state) => state.todos);
    }
    App.prototype.__render = jest.fn(App.prototype.__render);

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(App.prototype.__render).toBeCalledTimes(1);

    store.state.todos.push({ id: 3, msg: "hello" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");
    expect(App.prototype.__render).toBeCalledTimes(2);

    store.state.a = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");
    expect(App.prototype.__render).toBeCalledTimes(2);
  });

  test("connecting a component with useStore returning number", async () => {
    let nextId = 1;
    const state = { todos: [] };
    const actions = {
      addTodo({ state }, msg) {
        state.todos.push({ msg, id: nextId++ });
      },
    };
    const store = new Store({ state, actions });

    class App extends Component {
      static template = xml`<div><t t-esc="nbrTodos.value"/></div>`;
      nbrTodos = useStore((state) => ({ value: state.todos.length }));
    }

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>0</div>");

    await store.dispatch("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1</div>");
  });

  test("connecting a component with useStore returning number", async () => {
    let nextId = 1;
    const state = { todos: [], a: 1 };
    const actions = {
      addTodo({ state }, msg) {
        state.todos.push({ msg, id: nextId++ });
      },
      incrementA({ state }) {
        state.a++;
      },
    };
    const store = new Store({ state, actions });
    class App extends Component {
      static template = xml`<div><t t-esc="nbrTodos.value"/></div>`;
      nbrTodos = useStore((state) => ({ value: state.todos.length }), { isEqual: shallowEqual });
    }
    App.prototype.__render = jest.fn(App.prototype.__render);

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>0</div>");
    expect(App.prototype.__render).toBeCalledTimes(1);

    await store.dispatch("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1</div>");
    expect(App.prototype.__render).toBeCalledTimes(2);

    await store.dispatch("incrementA");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>1</div>");
    expect(App.prototype.__render).toBeCalledTimes(2);
  });

  test("connecting a component to a local store", async () => {
    let nextId = 1;
    const state = { todos: [] };
    const actions = {
      addTodo({ state }, msg) {
        state.todos.push({ msg, id: nextId++ });
      },
    };
    const store = new Store({ state, actions });

    class App extends Component {
      static template = xml`
            <div>
                <span t-foreach="todos" t-key="todo.id" t-as="todo"><t t-esc="todo.msg"/></span>
            </div>`;
      todos = useStore((state) => state.todos, { store });
    }

    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");

    await store.dispatch("addTodo", "hello");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>hello</span></div>");
  });

  test("can dispatch actions from a connected component", async () => {
    const store = new Store({
      state: { value: 1 },
      actions: {
        inc({ state }) {
          state.value++;
        },
      },
    });
    (<any>env).store = store;

    class App extends Component {
      static template = xml`
          <div>
              <button t-on-click="dispatch('inc')">Inc</button>
              <span><t t-esc="storeState.value"/></span>
          </div>`;
      storeState = useStore((state) => state);
      dispatch = useDispatch();
    }
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><button>Inc</button><span>1</span></div>");

    fixture.querySelector("button")!.click();
    await nextTick();

    expect(fixture.innerHTML).toBe("<div><button>Inc</button><span>2</span></div>");
  });

  test("useStore can use props", async () => {
    const state = {
      todos: [
        { id: 1, text: "jupiler" },
        { id: 2, text: "chimay" },
      ],
    };
    const store = new Store({ state, actions: {} });

    class TodoItem extends Component {
      static template = xml`<span><t t-esc="todo.text"/></span>`;
      todo = useStore((state, props) => {
        return state.todos.find((t) => t.id === props.todoId);
      });
    }

    class App extends Component {
      static template = xml`<div><TodoItem todoId="state.currentId"/></div>`;
      static components = { TodoItem };
      state = useState({ currentId: 1 });
    }

    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    app.state.currentId = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>chimay</span></div>");
  });

  test("useStore receives props as second argument", async () => {
    const state = { todos: [{ id: 1, text: "jupiler" }] };
    let nextId = 2;
    const actions = {
      addTodo({ state }, text) {
        state.todos.push({ text, id: nextId++ });
      },
    };
    const store = new Store({ state, actions });

    class TodoItem extends Component {
      static template = xml`<span><t t-esc="todo.text"/></span>`;
      todo = useStore((state, props) => {
        return state.todos.find((t) => t.id === props.id);
      });
    }

    class TodoList extends Component {
      static template = xml`
        <div>
          <TodoItem t-foreach="todos" t-as="todo" id="todo.id" t-key="todo.id"/>
        </div>`;
      static components = { TodoItem };
      todos = useStore((state) => state.todos);
    }

    (<any>env).store = store;
    const app = new TodoList();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.dispatch("addTodo", "hoegaarden");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span><span>hoegaarden</span></div>");
  });

  test("can call useGetters to receive store getters", async () => {
    const state = {
      importantID: 1,
      todos: [
        { id: 1, text: "jupiler" },
        { id: 2, text: "bertinchamps" },
      ],
    };
    const getters = {
      importantTodoText({ state }) {
        return state.todos.find((todo) => todo.id === state.importantID).text;
      },
      text({ state }, id) {
        return state.todos.find((todo) => todo.id === id).text;
      },
    };
    const store = new Store({ state, getters });

    class TodoItem extends Component {
      static template = xml`
        <div>
          <span><t t-esc="storeProps.activeTodoText"/></span>
          <span><t t-esc="storeProps.importantTodoText"/></span>
        </div>`;
      getters = useGetters();
      storeProps = useStore((state, props) => {
        const todo = state.todos.find((t) => t.id === props.id);
        return {
          activeTodoText: this.getters.text(todo.id),
          importantTodoText: this.getters.importantTodoText(),
        };
      });
    }

    class TodoList extends Component {
      static components = { TodoItem };
      static template = xml`
        <div>
          <t t-foreach="todos" t-as="todo">
            <TodoItem id="todo.id" t-key="todo.id"/>
          </t>
        </div>`;
      todos = useStore((state) => state.todos);
    }

    (<any>env).store = store;
    const app = new TodoList();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      "<div><div><span>jupiler</span><span>jupiler</span></div><div><span>bertinchamps</span><span>jupiler</span></div></div>"
    );
  });

  test("connected component is updated when props are updated", async () => {
    class Beer extends Component {
      static template = xml`<span><t t-esc="beer.name"/></span>`;
      beer = useStore((state, props) => state.beers[props.id]);
    }

    class App extends Component {
      static template = xml`<div><Beer id="state.beerId"/></div>`;
      static components = { Beer };
      state = useState({ beerId: 1 });
    }

    const state = { beers: { 1: { name: "jupiler" }, 2: { name: "kwak" } } };
    const store = new Store({ state });
    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    app.state.beerId = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>kwak</span></div>");
  });

  test("connected component is updated when store is changed", async () => {
    class App extends Component {
      static template = xml`
        <div>
            <span t-foreach="data.beers" t-as="beer" t-key="beer.name"><t t-esc="beer.name"/></span>
        </div>`;

      // we have here a new object
      data = useStore((state) => ({ beers: state.beers, otherKey: 1 }));
    }

    const actions = {
      addBeer({ state }, name) {
        state.beers.push({ name });
      },
    };

    const state = { beers: [{ name: "jupiler" }] };
    const store = new Store({ state, actions });
    (<any>env).store = store;

    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");

    store.dispatch("addBeer", "kwak");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span><span>kwak</span></div>");
  });

  test("connected component is updated when mixing store and props changes", async () => {
    let counter = 0;

    class Beer extends Component {
      static template = xml`<span><t t-esc="beer.name"/></span>`;
      beer = useStore((state, props) => state.beers[props.id], {
        onUpdate: (result) => {
          ++counter;
        },
      });
    }

    class App extends Component {
      static template = xml`<div><Beer id="state.beerId"/></div>`;
      static components = { Beer };
      state = useState({ beerId: 1 });
    }

    const state = { beers: { 1: { name: "jupiler" }, 2: { name: "kwak" } } };
    const actions = {
      renameBeer({ state }, { id, name }) {
        state.beers[id].name = name;
      },
    };
    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>jupiler</span></div>");
    expect(counter).toBe(0);

    app.state.beerId = 2;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>kwak</span></div>");
    expect(counter).toBe(1);

    store.dispatch("renameBeer", { id: 2, name: "orval" });
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>orval</span></div>");
    expect(counter).toBe(2);
  });

  test("connected component is properly cleaned up on destroy", async () => {
    class App extends Component {
      static template = xml`<div></div>`;
      state = useStore((state, props) => state);
    }

    const store = new Store({ state: {} });
    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(store.updateFunctions[app.__owl__.id].length).toBe(1);

    app.destroy();

    expect(store.updateFunctions[app.__owl__.id]).toBe(undefined);
  });

  test("connected component with undefined, null and string props", async () => {
    class Beer extends Component {
      static template = xml`
            <div t-name="Beer">
                <span>taster:<t t-esc="data.taster"/></span>
                <span t-if="data.selected">selected:<t t-esc="data.selected.name"/></span>
                <span t-if="data.consumed">consumed:<t t-esc="data.consumed.name"/></span>
            </div>`;
      data = useStore((state, props) => ({
        selected: state.beers[props.id],
        consumed: state.beers[state.consumedID] || null,
        taster: state.taster,
      }));
    }

    class App extends Component {
      static template = xml`<div><Beer id="state.beerId"/></div>`;
      static components = { Beer };
      state = useState({ beerId: 0 });
    }

    const actions = {
      consume({ state }, beerId) {
        state.consumedID = beerId;
      },
    };
    const state = {
      beers: {
        1: { name: "jupiler" },
      },
      consumedID: null,
      taster: "aaron",
    };
    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App();

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
    class Beer extends Component {
      static template = xml`
            <div>
                <span>taster:<t t-esc="info.taster"/></span>
                <span t-if="info.selected">selected:<t t-esc="info.selected.name"/></span>
                <span t-if="info.consumed">consumed:<t t-esc="info.consumed.name"/></span>
            </div>`;
      info = useStore(function (state, props) {
        return {
          selected: state.beers[props.id],
          consumed: state.beers[state.consumedID] || null,
          taster: state.taster,
        };
      });
    }

    class App extends Component {
      static template = xml`<div><Beer id="state.beerId"/></div>`;
      static components = { Beer };
      state = useState({ beerId: 0 });
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
      },
    };
    const state = {
      beers: {
        1: { name: "jupiler" },
      },
      consumedID: null,
      taster: "aaron",
    };
    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App();

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

  test("store changes occuring when mounting a component are notified", async () => {
    const initialState = { x: { val: 1 } };
    const actions = {
      setValue({ state }, val) {
        state.x.val = val;
      },
    };
    class Parent extends Component {
      static template = xml`<div><t t-esc="x.val"/></div>`;
      x = useStore((state) => {
        return Object.assign({}, state.x);
      });
      dispatch = useDispatch();
    }
    Parent.prototype.__render = jest.fn(Parent.prototype.__render);
    Parent.env.store = new Store({ state: initialState, actions });

    const parent = new Parent();
    const prom = parent.mount(fixture);
    parent.dispatch("setValue", 2);
    await prom;
    expect(fixture.innerHTML).toBe("<div>2</div>");
    expect(Parent.prototype.__render).toHaveBeenCalledTimes(1);
  });

  test("correct update order when parent/children are connected", async () => {
    const steps: string[] = [];

    class Child extends Component {
      static template = xml`<span><t t-esc="state.msg"/></span>`;

      state = useStore((state, props) => {
        steps.push("child");
        return { msg: state.msg[props.key] };
      });
    }
    class Parent extends Component {
      static template = xml`<div><Child key="state.current"/></div>`;
      static components = { Child };

      state = useStore((state) => {
        steps.push("parent");
        return {
          current: state.current,
          isvisible: state.isvisible,
        };
      });
    }

    const state = { current: "a", msg: { a: "a", b: "b" } };
    const actions = {
      setCurrent({ state }, c) {
        state.current = c;
      },
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new Parent();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><span>a</span></div>");
    expect(steps).toEqual(["parent", "child"]);

    store.dispatch("setCurrent", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div><span>b</span></div>");
    expect(steps).toEqual(["parent", "child", "parent", "child"]);
  });

  test("correct update order when parent/children are connected, part 2", async () => {
    const steps: string[] = [];
    let def = makeDeferred();
    def.resolve();

    class Child extends Component {
      static template = xml`<span><t t-esc="state.msg"/></span>`;
      state = useStore((s, props) => {
        steps.push("child");
        return { msg: s.messages[props.someId] };
      });
    }

    class Parent extends Component {
      static template = xml`
            <div>
                <Child t-if="state.flag" someId="state.someId"/>
            </div>`;
      static components = { Child };
      state = useStore((s) => {
        steps.push("parent");
        return { flag: s.flag, someId: s.someId };
      });

      async render(force) {
        await def;
        return super.render(force);
      }
    }

    const state = { someId: 1, flag: true, messages: { 1: "abc" } };
    const actions = {
      setFlagToFalse({ state }) {
        state.flag = false;
      },
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new Parent();

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
    let steps: string[] = [];
    const actions = {
      editTodo({ state }) {
        state.todos[1].title = "abc";
      },
    };
    const todos = { 1: { id: 1, title: "kikoou" } };
    const state = {
      todos,
    };
    const store = new Store({
      state,
      actions,
    });

    class TodoItem extends Component<{}, EnvWithStore> {
      static template = xml`
            <div class="todo">
                <t t-esc="state.todo.title"/>
                <button class="destroy" t-on-click="editTodo">x</button>
            </div>`;
      state = useStore((state, props) => {
        steps.push("item:usestore");
        return {
          todo: state.todos[props.id],
        };
      });

      editTodo() {
        this.env.store.dispatch("editTodo");
      }
      __render(f) {
        steps.push("item:render");
        return super.__render(f);
      }
    }
    class TodoApp extends Component {
      static template = xml`
            <div class="todoapp">
                <t t-foreach="Object.values(state.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>`;
      static components = { TodoItem };
      state = useStore((state) => {
        steps.push("app:usestore");
        return { todos: state.todos };
      });
      __render(f) {
        steps.push("app:render");
        return super.__render(f);
      }
    }

    (<any>env).store = store;
    const app = new TodoApp();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">kikoou<button class="destroy">x</button></div></div>'
    );

    expect(steps).toEqual(["app:usestore", "app:render", "item:usestore", "item:render"]);
    steps = [];
    fixture.querySelector("button")!.click();
    await nextTick();
    expect(steps).toEqual(["app:usestore", "app:render", "item:usestore", "item:render"]);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">abc<button class="destroy">x</button></div></div>'
    );
  });

  test("connected parent/children: no rendering if child is destroyed", async () => {
    let steps: string[] = [];
    const actions = {
      removeTodo({ state }) {
        delete state.todos[1];
      },
    };
    const todos = { 1: { id: 1, title: "kikoou" } };
    const state = {
      todos,
    };
    const store = new Store({
      state,
      actions,
    });

    class TodoItem extends Component<{}, EnvWithStore> {
      static template = xml`
            <div class="todo">
                <t t-esc="state.todo.title"/>
                <button class="destroy" t-on-click="removeTodo">x</button>
            </div>`;
      state = useStore((state, props) => {
        steps.push("item:usestore");
        return {
          todo: state.todos[props.id],
        };
      });

      removeTodo() {
        this.env.store.dispatch("removeTodo");
      }
      __render(f) {
        steps.push("item:render");
        return super.__render(f);
      }
    }

    class TodoApp extends Component {
      static template = xml`
            <div class="todoapp">
                <t t-foreach="Object.values(state.todos)" t-as="todo">
                    <TodoItem t-key="todo.id" id="todo.id"/>
                </t>
            </div>`;
      static components = { TodoItem };
      state = useStore((state) => {
        steps.push("app:usestore");
        return { todos: state.todos };
      });
      __render(f) {
        steps.push("app:render");
        return super.__render(f);
      }
    }

    (<any>env).store = store;
    const app = new TodoApp();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe(
      '<div class="todoapp"><div class="todo">kikoou<button class="destroy">x</button></div></div>'
    );

    expect(steps).toEqual(["app:usestore", "app:render", "item:usestore", "item:render"]);

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(steps).toEqual([
      "app:usestore",
      "app:render",
      "item:usestore",
      "item:render",
      "app:usestore",
      "app:render",
    ]);
    expect(fixture.innerHTML).toBe('<div class="todoapp"></div>');
  });

  test("connected component willpatch/patch hooks are called on store updates", async () => {
    const steps: string[] = [];

    class App extends Component {
      static template = xml`<div><t t-esc="store.msg"/></div>`;
      store = useStore((s) => ({ msg: s.msg }));

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
      },
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App();

    await app.mount(fixture);
    expect(fixture.innerHTML).toBe("<div>a</div>");

    store.dispatch("setMsg", "b");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div>b</div>");
    expect(steps).toEqual(["willpatch", "patched"]);
  });

  test("connected child components stop listening to store when destroyed", async () => {
    let steps: any = [];

    class Child extends Component {
      static template = xml`<div><t t-esc="store.val"/></div>`;
      store = useStore((s) => s);
    }

    class Parent extends Component {
      static template = xml`<div><Child t-if="state.child" /></div>`;
      static components = { Child };
      state = useState({ child: true });
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
    const parent = new Parent();

    await parent.mount(fixture);
    expect(steps).toEqual(["on:update"]);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");

    parent.state.child = false;
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps).toEqual(["on:update", "off:update"]);
  });

  test("connected child component destroyed by dispatched action", async () => {
    let steps: any = [];

    class Child extends Component {
      static template = xml`<div><t t-esc="store.val"/></div>`;
      store = useStore((s) => {
        steps.push("child selector");
        return s;
      });
    }
    class Parent extends Component {
      static template = xml`<div><Child t-if="store.child" /></div>`;
      static components = { Child };
      store = useStore((s) => {
        steps.push("parent selector");
        return s;
      });
      dispatch = useDispatch();
    }

    const state = { child: true, val: 1 };
    const actions = {
      toggleChild({ state }) {
        state.child = !state.child;
      },
    };
    const store = new Store({ state, actions });
    (<any>env).store = store;
    const parent = new Parent();

    await parent.mount(fixture);
    expect(fixture.innerHTML).toBe("<div><div>1</div></div>");
    expect(steps).toEqual(["parent selector", "child selector"]);

    parent.dispatch("toggleChild");
    await nextTick();
    expect(fixture.innerHTML).toBe("<div></div>");
    expect(steps).toEqual(["parent selector", "child selector", "parent selector"]);
  });

  test("dispatch an action", async () => {
    class App extends Component {
      static template = xml`<div><t t-esc="store.counter"/></div>`;
      store = useStore((state) => state);
      dispatch = useDispatch();
    }

    const state = {
      counter: 0,
    };

    const actions = {
      inc({ state }) {
        return ++state.counter;
      },
    };

    const store = new Store({ state, actions });
    (<any>env).store = store;
    const app = new App();

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
    Component.env = env;
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
      },
    };
    const state = {
      attachments: {
        100: {
          id: 100,
          name: "text.txt",
        },
      },
      messages: {
        10: {
          attachmentIds: [100],
          id: 10,
        },
      },
    };
    const store = new Store({ actions, state });

    class Attachment extends Component {
      static template = xml`
            <div>
                <span>Attachment <t t-esc="props.id"/></span>
                <span>Name: <t t-esc="attachment.name"/></span>
            </div>`;

      attachment = useStore((state, props) => ({ name: state.attachments[props.id].name }));
    }

    class Message extends Component {
      static template = xml`
            <div>
                <button t-on-click="doStuff">Do stuff</button>
                <Attachment t-foreach="store.attachmentIds" t-key="attachmentId" t-as="attachmentId" id="attachmentId"/>
            </div>`;

      store = useStore((state) => ({ attachmentIds: state.messages[10].attachmentIds }));
      static components = { Attachment };
      state = { isAttachmentDeleted: false };
      dispatch = useDispatch();
      doStuff() {
        this.dispatch("deleteAttachment", 100);
        this.state.isAttachmentDeleted = true;
      }
    }

    (<any>env).store = store;
    const message = new Message();

    await message.mount(fixture);

    expect(fixture.innerHTML).toMatchSnapshot();

    fixture.querySelector("button")!.click();
    await nextTick();
    expect(fixture.innerHTML).toMatchSnapshot();
  });
});
