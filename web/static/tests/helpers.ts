import { readFile } from "fs";
import { WEnv } from "../src/ts/core/component";
import { Callback } from "../src/ts/core/event_bus";
import { QWeb } from "../src/ts/core/qweb_vdom";
import { idGenerator } from "../src/ts/core/utils";
import { getMenuInfo } from "../src/ts/loaders";
import { actionRegistry } from "../src/ts/registries";
import { IRouter, Query, RouterEvent } from "../src/ts/services/router";
import { MenuInfo, Services, Store } from "../src/ts/store/store";

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

export function makeTestStore(services: Partial<Services> = {}): Store {
  const fullservices: Services = Object.assign(
    {
      rpc: mockFetch,
      router: new MockRouter()
    },
    services
  );
  const menuInfo = makeDemoMenuInfo();
  const store = new Store(fullservices, menuInfo, actionRegistry);
  return store;
}

function mockFetch(route: string, params: any): Promise<any> {
  return Promise.resolve(true);
}

export class MockRouter implements IRouter {
  currentQuery: Query;

  constructor(query: Query = {}) {
    this.currentQuery = query;
  }

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

export function nextMicroTick(): Promise<void> {
  return Promise.resolve();
}

export function nextTick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve));
}

interface Deferred extends Promise<any> {
  resolve(val?: any): void;
  reject(): void;
}

export function makeDeferred(): Deferred {
  let resolve, reject;
  let def = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  (<Deferred>def).resolve = resolve;
  (<Deferred>def).reject = reject;
  return <Deferred>def;
}
