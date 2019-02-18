import { INotification } from "../../src/ts/store/notifications";
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
  let n = 0;
  let notif;
  env.notifications.on("notification_added", null, _notif => {
    n++;
    notif = _notif;
  });
  env.notifications.on("notification_closed", null, () => n--);

  env.notifications.add({
    title: "title",
    message: "message",
    sticky: true
  });

  const navbar = new Notification(env, notif);
  await navbar.mount(fixture);
  expect(n).toBe(1);
  (<any>fixture.getElementsByClassName("o_close")[0]).click();
  expect(n).toBe(0);
});
