import { readFile } from "fs";
import { IAjax, RPCQuery } from "../src/ts/core/ajax";
import { WEnv } from "../src/ts/core/component";
import { Callback } from "../src/ts/core/event_bus";
import { NotificationManager } from "../src/ts/core/notifications";
import { QWeb } from "../src/ts/core/qweb_vdom";
import { Registry } from "../src/ts/core/registry";
import { IRouter, Query, RouterEvent } from "../src/ts/core/router";
import { idGenerator } from "../src/ts/core/utils";
import { getMenuInfo } from "../src/ts/init";
import { ActionEvent, IActionManager } from "../src/ts/services/action_manager";
import { MenuInfo } from "../src/ts/widgets/root";
import { Env } from "../src/ts/widgets/widget";

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

export interface MockEnv extends Env {
  router: MockRouter;
}

export function makeTestEnv(): MockEnv {
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
  currentQuery: Query = {};

  navigate(query: Query) {
    this.currentQuery = query;
  }
  on(event: RouterEvent, owner: any, callback: Callback) {}
  getQuery(): Query {
    return this.currentQuery;
  }

  formatURL(path: string, query: Query): string {
    return "";
  }

  setQuery(query: Query) {
    this.currentQuery = query;
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

export function makeDemoMenuInfo(): MenuInfo {
  return getMenuInfo([
    {
      id: 96,
      name: "Discuss",
      parent_id: false,
      action: "ir.actions.client,131",
      icon: "fa fa-comment",
      children: [
        {
          id: 97,
          name: "Integrations",
          parent_id: 96,
          action: false,
          icon: false,
          children: [
            {
              id: 188,
              name: "Github Repositories",
              parent_id: 97,
              action: "ir.actions.act_window,233",
              icon: false,
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 205,
      name: "Notes",
      parent_id: false,
      action: "ir.actions.act_window,250",
      icon: "fa fa-pen",
      children: []
    },
    {
      id: 409,
      name: "CRM",
      parent_id: false,
      action: "ir.actions.act_window,597",
      icon: "fa fa-handshake",
      children: [
        {
          id: 418,
          name: "Sales",
          parent_id: 409,
          action: false,
          icon: false,
          children: [
            {
              id: 423,
              name: "My Pipeline",
              parent_id: 418,
              action: "ir.actions.act_window,597",
              icon: false,
              children: []
            },
            {
              id: 812,
              name: "My Quotations",
              parent_id: 418,
              action: "ir.actions.act_window,1051",
              icon: false,
              children: []
            },
            {
              id: 419,
              name: "Team Pipelines",
              parent_id: 418,
              action: "ir.actions.act_window,275",
              icon: false,
              children: []
            }
          ]
        },
        {
          id: 421,
          name: "Leads",
          parent_id: 409,
          action: false,
          icon: false,
          children: [
            {
              id: 422,
              name: "Leads",
              parent_id: 421,
              action: "ir.actions.act_window,595",
              icon: false,
              children: []
            },
            {
              id: 752,
              name: "Scoring Rules",
              parent_id: 421,
              icon: false,
              action: "ir.actions.act_window,1083",
              children: []
            }
          ]
        }
      ]
    }
  ]);
}
