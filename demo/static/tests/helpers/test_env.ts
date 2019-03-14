import { readFileSync } from "fs";
import { WEnv } from "../../src/ts/core/component";
import { QWeb } from "../../src/ts/core/qweb_vdom";
import { Registry } from "../../src/ts/core/registry";
import { Env, InitData, linkStoreToEnv, makeEnv } from "../../src/ts/env";
import {
  actionRegistry as AR,
  viewRegistry as VR
} from "../../src/ts/registries";
import { Store } from "../../src/ts/store/store";
import { MockRouter } from "./mock_router";
import { MockServer } from "./mock_server";
import { makeTestData, TestData } from "./test_data";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface TestEnv extends Env {
  store: Store;
}

export interface TestInfo extends Partial<InitData>, Partial<TestData> {
  mockRPC?(this: MockServer, route: string, params: any): Promise<any>;
}

//------------------------------------------------------------------------------
// Code
//------------------------------------------------------------------------------

const TEMPLATES = readFileSync("demo/static/src/xml/templates.xml", "utf-8");

export function makeTestWEnv(): WEnv {
  return {
    qweb: new QWeb()
  };
}

export function makeTestEnv(info: TestInfo = {}): TestEnv {
  const templates = info.templates || TEMPLATES;
  const testData: TestData = makeTestData();
  if (info.menuInfo) {
    testData.menuInfo = info.menuInfo;
  }
  if (info.actions) {
    testData.actions = info.actions;
  }

  const actionRegistry = info.actionRegistry || cloneRegistry(AR);
  const viewRegistry = info.viewRegistry || cloneRegistry(VR);

  let rpc = info.services && info.services.rpc;
  if (!rpc) {
    const mockServer = new MockServer(testData);
    rpc = function(route: string, params: any): Promise<any> {
      if (info.mockRPC) {
        return info.mockRPC.call(mockServer, route, params);
      }
      return mockServer.rpc(route, params);
    };
  }

  const router = (info.services && info.services.router) || new MockRouter();
  const initData: InitData = {
    services: {
      rpc,
      router
    },
    actionRegistry,
    viewRegistry,
    templates
  };

  const env = makeEnv(initData);
  const store = new Store(env, testData.menuInfo);
  linkStoreToEnv(env, store);
  const testEnv = Object.assign({ store }, env);
  return testEnv;
}

function cloneRegistry<T>(registry: Registry<T>): Registry<T> {
  const clone: Registry<T> = new Registry();
  (<any>clone).map = Object.assign({}, (<any>registry).map);
  return clone;
}
