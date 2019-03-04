import { debounce } from "../core/utils";
import { Env } from "../env";
import { State, Store } from "../store/store";
import { HomeMenu } from "./home_menu";
import { Navbar } from "./navbar";
import { Notification } from "./notification";
import { Widget } from "./widget";
import { Action } from "../store/action_manager_mixin";

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------

export class Root extends Widget<Store, State> {
  template = "web.web_client";
  widgets = { Navbar, HomeMenu };

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

    // actions
    this.store.on("update_action", this, this.applyAction);
    if (this.store.lastAction) {
      this.applyAction(this.store.lastAction);
    }
  }

  async applyAction(action: Action) {
    const widget = await action.executor(this);
    if (widget) {
      // to do: call some public method of widget instead...
      (<HTMLElement>this.refs.content).appendChild(widget.el!);
      widget.__mount();
      action.activate();
    }
  }
}
