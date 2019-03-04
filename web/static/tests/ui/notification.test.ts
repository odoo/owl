import { Notification as INotification } from "../../src/ts/store/store";
import { Notification } from "../../src/ts/ui/notification";
import * as helpers from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: helpers.TestEnv;

beforeEach(async () => {
  fixture = helpers.makeTestFixture();
  const data = await helpers.makeTestData();
  env = helpers.makeTestEnv(data);
});

afterEach(() => {
  fixture.remove();
});

function makeNotification(notif: Partial<INotification> = {}): INotification {
  const defaultNotif = {
    id: 1,
    title: "title",
    message: "message",
    type: "notification",
    sticky: false
  };
  return Object.assign(defaultNotif, notif);
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered", async () => {
  const notif = makeNotification({ title: "title", message: "message" });
  const navbar = new Notification(env, notif);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("can be rendered (type = warning)", async () => {
  const notif = makeNotification({
    title: "title",
    message: "message",
    type: "warning"
  });
  const navbar = new Notification(env, notif);
  await navbar.mount(fixture);
  expect(fixture.innerHTML).toMatchSnapshot();
});

test("can be closed by clicking on it (if sticky)", async () => {
  env.addNotification({
    title: "title",
    message: "message",
    sticky: true
  });

  const navbar = new Notification(env, env.store.state.notifications[0]);
  await navbar.mount(fixture);
  expect(env.store.state.notifications.length).toBe(1);
  (<any>fixture.getElementsByClassName("o_close")[0]).click();
  expect(env.store.state.notifications.length).toBe(0);
});
