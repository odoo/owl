import { QWeb } from "../src/ts/core/qweb_vdom";
import { idGenerator } from "../src/ts/core/utils";
import { WEnv } from "../src/ts/core/widget";
import { Env } from "../src/ts/env";
import { IAjax, RPC } from "../src/ts/services/ajax";
import {
  IActionManager,
  ActionEvent,
  ActionWidget
} from "../src/ts/services/action_manager";
import { Callback } from "../src/ts/core/event_bus";
import { IRouter, Query, RouterEvent } from "../src/ts/services/router";

export function makeTestFixture() {
  let fixture = document.createElement("div");
  document.body.appendChild(fixture);
  return fixture;
}

export function makeTestWEnv(): WEnv {
  return {
    qweb: new QWeb(),
    getID: idGenerator()
  };
}

export function makeTestEnv(): Env {
  const ajax = new MockAjax();
  const actionManager = new MockActionManager();
  const router = new MockRouter();
  let { qweb, getID } = makeTestWEnv();
  return {
    qweb,
    getID,
    ajax,
    actionManager,
    router,
    rpc: ajax.rpc,
    debug: false,
    menus: []
  };
}

class MockAjax implements IAjax {
  async rpc(rpc: RPC) {
    return true;
  }
}

class MockActionManager implements IActionManager {
  doAction(actionID: number) {}
  on(event: ActionEvent, owner: any, callback: Callback) {}
  getCurrentAction(): ActionWidget | null {
    return null;
  }
}

class MockRouter implements IRouter {
  navigate(query: Query) {}
  on(event: RouterEvent, owner: any, callback: Callback) {}
  getQuery(): Query {
    return {};
  }
  formatURL(path: string, query: Query): string {
    return "";
  }
}

export function normalize(str: string): string {
  return str.replace(/\s+/g, "");
}
