import { debounce } from "../core/utils";
import { Env } from "../env";
import { Controller } from "../store/action_manager_mixin";
import { State, Store } from "../store/store";
import { Widget } from "../widget";
import { HomeMenu } from "./home_menu";
import { Navbar } from "./navbar";
import { Notification } from "./notification";

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------

export class Root extends Widget<Store, State> {
  template = "web.web_client";
  widgets = { Navbar, HomeMenu, Notification };

  store: Store;

  constructor(env: Env, store: Store) {
    super(env, store);
    this.store = store;
    this.state = store.state;
  }

  mounted() {
    this.store.on("state_updated", this, this.updateState);
    this.store.on("rpc_status", this, this.toggleLoadingIndicator);
    this.store.on("update_action", this, this.applyController);
    if (this.store.lastController) {
      this.applyController(this.store.lastController);
    }

    // adding reactiveness to mobile/non mobile
    window.addEventListener("resize", <any>(
      debounce(this.applyMobileInterface.bind(this), 50)
    ));
  }

  applyMobileInterface() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile !== this.env.isMobile) {
      this.env.isMobile = isMobile;
      this.render();
    }
  }

  toggleLoadingIndicator(status: "loading" | "notloading") {
    const method = status === "loading" ? "remove" : "add";
    (<any>this.refs.loading_indicator).classList[method]("d-none");
  }

  async applyController(controller: Controller) {
    const widget = await controller.create(this);
    if (widget) {
      // to do: call some public method of widget instead...
      (<HTMLElement>this.refs.content).appendChild(widget.el!);
      widget.__mount();
      widget.el!.classList.add("o_action_controller");
      this.store.activateController(controller);
    }
  }
}
