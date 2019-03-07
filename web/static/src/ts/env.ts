import { WEnv } from "./core/component";
import { QWeb } from "./core/qweb_vdom";
import { Registry } from "./core/registry";
import { idGenerator } from "./core/utils";
import { RPC } from "./services/ajax";
import { IRouter } from "./services/router";
import { ControllerWidget, Store, Notification } from "./store/store";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Services {
  rpc: RPC;
  router: IRouter;
}

export interface Env extends WEnv {
  services: Services;

  // registries
  actionRegistry: Registry<ControllerWidget>;
  viewRegistry: Registry<ControllerWidget>;

  // commands
  activateMenuItem(menuId: number): void;
  addNotification(notif: Partial<Notification>): number;
  closeNotification(id: number): void;
  toggleHomeMenu(): void;

  // helpers
  rpc: RPC;

  // configuration
  debug: boolean;
  isMobile: boolean;
}

export interface InitData {
  services: Services;
  templates: string;
  actionRegistry: Registry<ControllerWidget>;
  viewRegistry: Registry<ControllerWidget>;
}

//------------------------------------------------------------------------------
// Environment
//------------------------------------------------------------------------------

export function makeEnv(data: InitData): Env {
  const qweb = new QWeb();
  qweb.addTemplate("default", "<div/>");
  qweb.loadTemplates(data.templates);

  function throwNonImplementedError(): any {
    throw new Error("Not implemented. This feature requires a store.");
  }

  const env: Env = {
    qweb,
    getID: idGenerator(),

    services: data.services,
    actionRegistry: data.actionRegistry,
    viewRegistry: data.viewRegistry,

    activateMenuItem: throwNonImplementedError,
    addNotification: throwNonImplementedError,
    closeNotification: throwNonImplementedError,
    toggleHomeMenu: throwNonImplementedError,

    rpc: throwNonImplementedError,

    debug: false,
    isMobile: window.innerWidth <= 768
  };
  return env;
}

export function linkStoreToEnv(env: Env, store: Store) {
  env.activateMenuItem = store.activateMenuItem.bind(store);
  env.addNotification = store.addNotification.bind(store);
  env.closeNotification = store.closeNotification.bind(store);
  env.toggleHomeMenu = store.toggleHomeMenu.bind(store);
  env.rpc = store.rpc.bind(store);
}
