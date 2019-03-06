import { WEnv } from "../../src/ts/core/component";
import { QWeb } from "../../src/ts/core/qweb_vdom";
import { Registry } from "../../src/ts/core/registry";
import { idGenerator } from "../../src/ts/core/utils";
import { Env, makeEnv } from "../../src/ts/env";
import { IRouter } from "../../src/ts/services/router";
import { MenuInfo, Store } from "../../src/ts/store/store";
import { MockRouter } from "./mock_router";
import { MockServer } from "./mock_server";
import { TestData } from "./test_data";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface TestEnv extends Env {
  store: Store;
}

export interface TestInfo extends Partial<TestData> {
  mockRPC?(this: MockServer, route: string, params: any): Promise<any>;
  router?: IRouter;
}

export function makeTestWEnv(): WEnv {
  return {
    qweb: new QWeb(),
    getID: idGenerator()
  };
}

//------------------------------------------------------------------------------
// Code
//------------------------------------------------------------------------------

export function makeTestEnv(info: TestInfo = {}): TestEnv {
  const templates = info.templates || "";
  const menuInfo: MenuInfo = info.menuInfo || {
    menus: {},
    actionMap: {},
    roots: []
  };
  const actionRegistry = info.actionRegistry || new Registry();
  const viewRegistry = info.viewRegistry || new Registry();
  const actions = info.actions || [];

  const data: TestData = {
    menuInfo,
    actions,
    actionRegistry,
    viewRegistry,
    templates
  };

  const mockServer = new MockServer(data);

  function rpc(route: string, params: any): Promise<any> {
    if (info.mockRPC) {
      return info.mockRPC.call(mockServer, route, params);
    }
    return mockServer.rpc(route, params);
  }
  const services = {
    rpc,
    router: info.router || new MockRouter()
  };

  const store = new Store(services, menuInfo, actionRegistry, viewRegistry);
  const env = makeEnv(store, templates);
  const testEnv = Object.assign({ store }, env);
  return testEnv;
}
