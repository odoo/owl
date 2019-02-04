import { Env } from "../../src/ts/env";
import { HomeMenu, Props } from "../../src/ts/widgets/home_menu";
import { makeTestEnv, makeTestFixture, loadTemplates } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: Env;
let props: Props;
let templates: string;

beforeAll(async () => {
  templates = await loadTemplates();
});

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  env.qweb.loadTemplates(templates);
  props = {
    menuInfo: {
      menuMap: {
        14: {
          id: 14,
          name: "Demo",
          parent_id: false,
          action: false,
          icon: "fa fa-test",
          children: [],
          menuId: 14,
          actionId: 43
        }
      },
      roots: [14]
    }
  };
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
