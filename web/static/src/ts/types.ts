import { WidgetEnv } from "./core/widget";
import Router from "./services/router";

export interface Env extends WidgetEnv {
  router: Router;
  services: { [key: string]: any };
}

export interface Type<T> extends Function {
  new (...args: any[]): T;
}
