import { Env, makeEnv } from "../../src/ts/env";
import { MenuInfo, Store } from "../../src/ts/store/store";
import { Navbar, Props } from "../../src/ts/ui/navbar";
import * as helpers from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let store: Store;
let env: Env;
let props: Props;
let menuInfo: MenuInfo;
let templates: string;

beforeAll(async () => {
  templates = await helpers.loadTemplates();
});

beforeEach(() => {
  fixture = helpers.makeTestFixture();
  store = helpers.makeTestStore();
  env = makeEnv(store, templates);
  props = { inHome: false, app: null };
  menuInfo = helpers.makeDemoMenuInfo();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered (in home menu, no app)", async () => {
  props.inHome = true;
  const navbar = new Navbar(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("can be rendered (in home menu, one active app)", async () => {
  props = { inHome: true, app: menuInfo.menus[96]! };
  const navbar = new Navbar(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("can render one menu item", async () => {
  props.app = menuInfo.menus[96]!;
  const navbar = new Navbar(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("mobile mode: navbar is different", async () => {
  props.app = menuInfo.menus[205]!;
  env.isMobile = true;
  const navbar = new Navbar(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("clicking on left icon toggle home menu ", async () => {
  props.app = menuInfo.menus[96]!;
  store.state.inHome = false;
  const navbar = new Navbar(env, props);
  await navbar.mount(fixture);
  expect(store.state.inHome).toBe(false);
  (<any>fixture).getElementsByClassName("o_title")[0].click();
  expect(store.state.inHome).toBe(true);
});
