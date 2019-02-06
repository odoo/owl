import { Root, Props } from "../../src/ts/widgets/root";
import * as helpers from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: ReturnType<typeof helpers.makeTestEnv>;
let props: Props;
let templates: string;

beforeAll(async () => {
  templates = await helpers.loadTemplates();
});

beforeEach(() => {
  fixture = helpers.makeTestFixture();
  env = helpers.makeTestEnv();
  env.qweb.loadTemplates(templates);
  props = { menuInfo: helpers.makeDemoMenuInfo() };
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered (in home menu)", async () => {
  const root = new Root(env, props);
  await root.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("if url has action_id, will render action and navigate to proper menu_id", async () => {
  env.router.setQuery({ action_id: "595" });
  const root = new Root(env, props);
  await root.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
  // we check here that the url was changed to set app id as menu_id
  expect(env.router.currentQuery).toEqual({ action_id: "595", menu_id: "409" });
});

test("start with no action => clicks on client action => discuss is rendered", async () => {
  const root = new Root(env, props);
  await root.mount(fixture);

  expect(env.router.currentQuery).toEqual({});

  // discuss menu item
  await (<any>document.querySelector('[data-menu="96"]')).click();
  await helpers.nextTick();
  expect(fixture.innerHTML).toMatchSnapshot();
  expect(env.router.currentQuery).toEqual({ action_id: "131", menu_id: "96" });
});
