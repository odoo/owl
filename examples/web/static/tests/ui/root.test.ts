import { Registry } from "../../../../../src/registry";
import { Root } from "../../src/ts/ui/root";
import * as helpers from "../helpers";
import { makeTestEnv } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;

beforeEach(() => {
  fixture = helpers.makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered (in home menu)", async () => {
  const testEnv = makeTestEnv();
  const root = new Root(testEnv, testEnv.store);
  await root.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("if url has action_id, will render action and navigate to proper menu_id", async () => {
  const router = new helpers.MockRouter({ action_id: "131" });
  const testEnv = makeTestEnv({ services: <any>{ router } });
  await helpers.nextTick();

  const root = new Root(testEnv, testEnv.store);
  await root.mount(fixture);
  await helpers.nextTick();
  expect(router.getQuery()).toEqual({
    action_id: "131",
    menu_id: "96"
  });
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("start with no action => clicks on client action => discuss is rendered", async () => {
  const testEnv = makeTestEnv();
  const root = new Root(testEnv, testEnv.store);
  await root.mount(fixture);

  expect(testEnv.services.router.getQuery()).toEqual({ home: true });

  // discuss menu item
  await (<any>document.querySelector('[data-menu="96"]')).click();
  await helpers.nextTick();
  expect(fixture.innerHTML).toMatchSnapshot();
  expect(testEnv.services.router.getQuery()).toEqual({
    action_id: "131",
    menu_id: "96"
  });
});

test("clicks on client action with invalid key => empty widget is rendered + warning", async () => {
  const testEnv = makeTestEnv({ actionRegistry: new Registry() });
  const root = new Root(testEnv, testEnv.store);
  await root.mount(fixture);

  // discuss menu item
  await (<any>document.querySelector('[data-menu="96"]')).click();
  await helpers.nextTick();

  expect(fixture.innerHTML).toMatchSnapshot();
});

test("open act window action with invalid viewtype => empty widget is rendered + warning", async () => {
  const testEnv = makeTestEnv({ viewRegistry: new Registry() });
  const root = new Root(testEnv, testEnv.store);
  await root.mount(fixture);

  // note menu item
  await (<any>document.querySelector('[data-menu="205"]')).click();
  await helpers.nextTick();

  expect(fixture.innerHTML).toMatchSnapshot();
});
