import { WEnv } from "./core/component";
import { QWeb } from "./core/qweb_vdom";
import { idGenerator } from "./core/utils";
import { Notification, RPC, Services, Store } from "./store/store";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Env extends WEnv {
  services: Services;

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

    activateMenuItem: store.activateMenuItem.bind(store),
    addNotification: store.addNotification.bind(store),
    closeNotification: store.closeNotification.bind(store),
    toggleHomeMenu: store.toggleHomeMenu.bind(store),

    rpc: store.rpc.bind(store),

    debug: false,
    isMobile: window.innerWidth <= 768
  };
  return env;
}
