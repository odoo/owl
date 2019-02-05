import { Navbar, Props } from "../../src/ts/widgets/navbar";
import { makeTestEnv, makeTestFixture, loadTemplates } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: ReturnType<typeof makeTestEnv>;
let props: Props;
let templates: string;

beforeAll(async () => {
  templates = await loadTemplates();
});

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  env.qweb.loadTemplates(templates);
  props = { inHome: false, app: null };
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
  const navbar = new Navbar(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("mobile mode: navbar is different", async () => {
  env.isMobile = true;
  const navbar = new Navbar(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});
