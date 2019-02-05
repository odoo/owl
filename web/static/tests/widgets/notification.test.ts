import { INotification } from "../../src/ts/core/notifications";
import { Notification } from "../../src/ts/widgets/notification";
import { makeTestEnv, makeTestFixture, loadTemplates } from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let env: ReturnType<typeof makeTestEnv>;
let templates: string;

beforeAll(async () => {
  templates = await loadTemplates();
});

beforeEach(() => {
  fixture = makeTestFixture();
  env = makeTestEnv();
  env.qweb.loadTemplates(templates);
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
  let notifs: INotification[] = [];
  env.notifications.on(
    "notifications_updated",
    null,
    _notifs => (notifs = _notifs)
  );
  env.notifications.add({
    title: "title",
    message: "message",
    sticky: true
  });

  const navbar = new Notification(env, notifs[0]);
  await navbar.mount(fixture);
  expect(notifs.length).toBe(1);
  (<any>fixture.getElementsByClassName("o_close")[0]).click();
  expect(notifs.length).toBe(0);
});
