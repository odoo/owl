import { Env, makeEnv } from "../../src/ts/env";
import { Store } from "../../src/ts/store/store";
import { Root } from "../../src/ts/widgets/root";
import * as helpers from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let store: Store;
let env: Env;
let templates: string;

beforeAll(async () => {
  templates = await helpers.loadTemplates();
});

beforeEach(() => {
  fixture = helpers.makeTestFixture();
  store = helpers.makeTestStore();
  env = makeEnv(store, templates);
  // props = { menuInfo: helpers.makeDemoMenuInfo() };
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered (in home menu)", async () => {
  const root = new Root(env, store);
  await root.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("if url has action_id, will render action and navigate to proper menu_id", async () => {
  const router = new helpers.MockRouter({ action_id: "595" });
  store = helpers.makeTestStore({ router });
  env = makeEnv(store, templates);
  await helpers.nextTick();

  const root = new Root(env, store);
  await root.mount(fixture);
  expect(env.services.router.getQuery()).toEqual({
    action_id: "595",
    menu_id: "409"
  });
  expect(fixture.innerHTML).toMatchSnapshot();
  // we check here that the url was changed to set app id as menu_id
});

test("start with no action => clicks on client action => discuss is rendered", async () => {
  const root = new Root(env, store);
  await root.mount(fixture);

  expect(env.services.router.getQuery()).toEqual({});

  // discuss menu item
  await (<any>document.querySelector('[data-menu="96"]')).click();
  await helpers.nextTick();
  expect(fixture.innerHTML).toMatchSnapshot();
  expect(env.services.router.getQuery()).toEqual({
    action_id: "131",
    menu_id: "96"
  });
});
