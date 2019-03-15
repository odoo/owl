import { HomeMenu } from "../../src/ts/ui/home_menu";
import { makeTestEnv, makeTestFixture } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered", async () => {
  const testEnv = makeTestEnv();
  const props = { menuInfo: testEnv.store.menuInfo };
  const homeMenu = new HomeMenu(testEnv, props);
  await homeMenu.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});
