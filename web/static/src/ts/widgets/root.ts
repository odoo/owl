import { debounce } from "../core/utils";
import { Env } from "../env";
import { State, Store } from "../store";
import { ActionContainer } from "./action_container";
import { HomeMenu } from "./home_menu";
import { Navbar } from "./navbar";
import { Notification } from "./notification";
import { Widget } from "./widget";

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------

export class Root extends Widget<Store, State> {
  template = "web.web_client";
  widgets = { Navbar, HomeMenu, ActionContainer };

  notifications: { [id: number]: Notification } = {};
  store: Store;

  constructor(env: Env, store: Store) {
    super(env, store);
    this.store = store;
    this.state = store.state;
  }
  mounted() {
    this.store.on("state_updated", this, newState => {
      this.updateState(newState);
    });

    // notifications
    this.store.on("notification_added", this, notif => {
      const notification = new Notification(this, notif);
      this.notifications[notif.id] = notification;
      notification.mount(<any>this.refs.notification_container);
    });
    this.store.on("notification_closed", this, id => {
      this.notifications[id].destroy();
      delete this.notifications[id];
    });

    // loading indicator
    this.store.on("rpc_status", this, status => {
      const method = status === "loading" ? "remove" : "add";
      (<any>this.refs.loading_indicator).classList[method]("d-none");
    });

    // adding reactiveness to mobile/non mobile
    window.addEventListener("resize", <any>debounce(() => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile !== this.env.isMobile) {
        this.env.isMobile = isMobile;
        this.render();
      }
    }, 50));
  }
}
