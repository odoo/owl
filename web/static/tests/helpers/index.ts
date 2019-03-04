import { readFile } from "fs";
import { WEnv } from "../../src/ts/core/component";
import { Callback } from "../../src/ts/core/event_bus";
import { QWeb } from "../../src/ts/core/qweb_vdom";
import { idGenerator } from "../../src/ts/core/utils";
import { getMenuInfo } from "../../src/ts/loaders";
import { menuInfo, actions } from "./test_data";
import { actionRegistry } from "../../src/ts/registries";
import { IRouter, Query, RouterEvent } from "../../src/ts/services/router";
import { MenuInfo, Services, Store } from "../../src/ts/store/store";

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

export function mockFetch(route: string, params: any): Promise<any> {
  if (route === "web/action/load") {
    const action = actions.find(a => a.id === params.action_id);
    return Promise.resolve(action);
  }
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
  return getMenuInfo(menuInfo);
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
