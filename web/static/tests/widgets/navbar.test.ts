import { Navbar, Props } from "../../src/ts/widgets/navbar";
import * as helpers from "../helpers";
import { MenuInfo } from "../../src/ts/widgets/root";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: ReturnType<typeof helpers.makeTestEnv>;
let props: Props;
let menuInfo: MenuInfo;
let templates: string;

beforeAll(async () => {
  templates = await helpers.loadTemplates();
});

beforeEach(() => {
  fixture = helpers.makeTestFixture();
  env = helpers.makeTestEnv();
  env.qweb.loadTemplates(templates);
  props = { inHome: false, app: null };
  menuInfo = helpers.makeDemoMenuInfo();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered", async () => {
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
