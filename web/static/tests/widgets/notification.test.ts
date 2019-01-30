import { Env } from "../../src/ts/env";
import { INotification } from "../../src/ts/services/notifications";
import { Notification } from "../../src/ts/widgets/notification";
import { makeTestEnv, makeTestFixture } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: Env;

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
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

test("can be closed by clicking on it (if sticky)", async () => {
  let notif: INotification;
  let removed = false;
  env.notifications.on("notification_added", null, _notif => (notif = _notif));
  env.notifications.add({
    title: "title",
    message: "message",
    sticky: true
  });
  env.notifications.on("notification_removed", null, () => (removed = true));

  const navbar = new Notification(env, notif!);
  await navbar.mount(fixture);
  expect(removed).toBe(false);
  (<any>fixture.getElementsByClassName("o_close")[0]).click();
  expect(removed).toBe(true);
});
