import { Env, makeEnv } from "../../src/ts/env";
import { ActionStack, Store } from "../../src/ts/store/store";
import { ActionContainer, Props } from "../../src/ts/widgets/action_container";
import { Widget } from "../../src/ts/widgets/widget";
import * as helpers from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let store: Store;
let env: Env;
let props: Props;
let templates: string;

beforeAll(async () => {
  templates = await helpers.loadTemplates();
});

beforeEach(() => {
  fixture = helpers.makeTestFixture();
  store = helpers.makeTestStore();
  env = makeEnv(store, templates);
  props = { stack: [] };
});

afterEach(() => {
  fixture.remove();
});

class ClientAction extends Widget<{}, {}> {
  inlineTemplate = "<div>some client action</div>";
}

const demoStack: ActionStack = [
  {
    id: 33,
    context: {},
    title: "some title",
    target: "new",
    type: "client",
    name: "hey",
    Widget: ClientAction
  }
];

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered with an empty stack", async () => {
  const container = new ActionContainer(env, props);
  await container.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("can be rendered with a non empty stack", async () => {
  props.stack = demoStack;
  const container = new ActionContainer(env, props);
  await container.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("content is updated properly when new props are given", async () => {
  const container = new ActionContainer(env, props);
  await container.mount(fixture);
  await container.updateProps({ stack: demoStack });
  await helpers.nextTick();
  expect(fixture.innerHTML).toMatchSnapshot();
});
