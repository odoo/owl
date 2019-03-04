import { Env, makeEnv } from "../../src/ts/env";
import { Store } from "../../src/ts/store/store";
import { HomeMenu, Props } from "../../src/ts/ui/home_menu";
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
  props = { menuInfo: helpers.makeDemoMenuInfo() };
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered", async () => {
  const homeMenu = new HomeMenu(env, props);
  await homeMenu.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});
