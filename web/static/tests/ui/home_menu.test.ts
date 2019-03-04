import { HomeMenu } from "../../src/ts/ui/home_menu";
import { makeTestData, makeTestEnv, makeTestFixture } from "../helpers";

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
  const data = await makeTestData();
  const testEnv = makeTestEnv(data);
  const props = { menuInfo: data.menuInfo };
  const homeMenu = new HomeMenu(testEnv, props);
  await homeMenu.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});
