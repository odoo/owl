import { Env } from "../../src/ts/env";
import { makeTestEnv, makeTestFixture, normalize } from "../helpers";
import { Navbar } from "../../src/ts/widgets/navbar";

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

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

test("can be rendered", async () => {
  const navbar = new Navbar(env);
  await navbar.mount(fixture);
  expect(normalize(fixture.innerHTML)).toBe(
    normalize(`
    <div class=\"o_navbar\">
        <span class=\"title\">Odoo</span>
        <ul></ul>
    </div>`)
  );
});

test("can render one menu item", async () => {
  env.menus.push({ title: "menu", actionID: 4 });
  const navbar = new Navbar(env);
  await navbar.mount(fixture);
  expect(normalize(fixture.innerHTML)).toBe(
    normalize(`
    <div class=\"o_navbar\">
        <span class=\"title\">Odoo</span>
        <ul>
            <li><ahref=\"\">menu</a></li>
        </ul>
    </div>`)
  );
});
