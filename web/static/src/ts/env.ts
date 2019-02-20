import { WEnv } from "./core/component";
import { QWeb } from "./core/qweb_vdom";
import { idGenerator } from "./core/utils";
import { INotification, RPC, Services, Store } from "./store";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Env extends WEnv {
  services: Services;

  // helpers
  dispatch(action: string, param?: any): void;
  addNotification(notif: Partial<INotification>): number;
  closeNotification(id: number);
  rpc: RPC;

  // configuration
  debug: boolean;
  isMobile: boolean;
}

//------------------------------------------------------------------------------
// Environment
//------------------------------------------------------------------------------

export function makeEnv(store: Store, templates: string): Env {
  const qweb = new QWeb();
  qweb.addTemplate("default", "<div/>");
  qweb.loadTemplates(templates);

  const env: Env = {
    qweb,
    getID: idGenerator(),
    services: store.services,
    dispatch: store.dispatch.bind(store),
    addNotification: store.addNotification.bind(store),
    closeNotification: store.closeNotification.bind(store),
    rpc: store.rpc.bind(store),
    debug: false,
    isMobile: window.innerWidth <= 768
  };
  return env;
}
