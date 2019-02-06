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
  const navbar = new Root(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("if url has action_id, will render action and navigate to proper menu_id", async () => {
  env.router.setQuery({ action_id: "595" });
  const navbar = new Root(env, props);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
  // we check here that the url was changed to set app id as menu_id
  expect(env.router.currentQuery).toEqual({ action_id: "595", menu_id: "409" });
});
