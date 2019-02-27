import { Env, makeEnv } from "../../src/ts/env";
import { INotification, Store } from "../../src/ts/store/store";
import { Notification } from "../../src/ts/widgets/notification";
import * as helpers from "../helpers";

//------------------------------------------------------------------------------
// Setup and helpers
//------------------------------------------------------------------------------

let fixture: HTMLElement;
let store: Store;
let env: Env;
let templates: string;

beforeAll(async () => {
  templates = await helpers.loadTemplates();
});

beforeEach(() => {
  fixture = helpers.makeTestFixture();
  fixture = helpers.makeTestFixture();
  store = helpers.makeTestStore();
  env = makeEnv(store, templates);
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
  store.on("notification_added", null, _notif => {
    n++;
    notif = _notif;
  });
  store.on("notification_closed", null, () => n--);

  env.addNotification({
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
