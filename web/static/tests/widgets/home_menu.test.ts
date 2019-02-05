import { HomeMenu, Props } from "../../src/ts/widgets/home_menu";
import { makeTestEnv, makeTestFixture, loadTemplates } from "../helpers";
import { MenuItem } from "../../src/ts/widgets/root";

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
  const demoItem: MenuItem = <any>{
    id: 14,
    name: "Demo",
    parentId: false,
    action: false,
    icon: "fa fa-test",
    children: [],
    actionId: 43
  };
  demoItem.app = demoItem;
  props = {
    menuInfo: {
      menus: {
        14: demoItem
      },
      actionMap: { 43: demoItem },
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
