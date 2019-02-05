import { IAjax } from "../core/ajax";
import { Component, PureComponent, WEnv } from "../core/component";
import { INotificationManager } from "../core/notifications";
import { Registry } from "../core/registry";
import { IRouter } from "../core/router";
import { ActionWidget, IActionManager } from "../services/action_manager";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface Env extends WEnv {
  // services
  actionManager: IActionManager;
  ajax: IAjax;
  notifications: INotificationManager;
  router: IRouter;

  // registries
  actionRegistry: Registry<ActionWidget>;

  // helpers
  rpc: IAjax["rpc"];

  // configuration
  debug: boolean;
  isMobile: boolean;
}

//------------------------------------------------------------------------------
// Widget classes
//------------------------------------------------------------------------------

export class Widget<Props, State> extends Component<Env, Props, State> {}

export class PureWidget<Props, State> extends PureComponent<
  Env,
  Props,
  State
> {}
