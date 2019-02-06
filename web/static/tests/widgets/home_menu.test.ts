import { HomeMenu, Props } from "../../src/ts/widgets/home_menu";
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

test("can be rendered", async () => {
  const homeMenu = new HomeMenu(env, props);
  await homeMenu.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});
