import { QWeb } from "../src/ts/core/qweb_vdom";
import { idGenerator } from "../src/ts/core/utils";
import { WEnv } from "../src/ts/core/component";
import { Env } from "../src/ts/widgets/widget";
import { IAjax, RPCQuery } from "../src/ts/core/ajax";
import { Registry } from "../src/ts/core/registry";
import { NotificationManager } from "../src/ts/core/notifications";

import { IActionManager, ActionEvent } from "../src/ts/services/action_manager";
import { Callback } from "../src/ts/core/event_bus";
import { IRouter, Query, RouterEvent } from "../src/ts/core/router";
import { readFile } from "fs";

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
  const notifications = new NotificationManager();
  let { qweb, getID } = makeTestWEnv();
  return {
    qweb,
    getID,
    actionRegistry: new Registry(),
    ajax,
    actionManager,
    notifications,
    router,
    rpc: ajax.rpc,
    debug: false,
    isMobile: false
  };
}

class MockAjax implements IAjax {
  async rpc(rpc: RPCQuery) {
    return true;
  }
}

class MockActionManager implements IActionManager {
  doAction(actionID: number) {}
  on(event: ActionEvent, owner: any, callback: Callback) {}
  activate() {}
  getStack() {
    return [];
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

export async function loadTemplates(): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile("web/static/src/xml/templates.xml", "utf-8", (err, result) => {
      resolve(result);
    });
  });
}
