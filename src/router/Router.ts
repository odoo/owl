import { Env } from "../component/component";
import { QWeb } from "../qweb/index";
import { makeDirective } from "./directive";
import { LINK_TEMPLATE, LINK_TEMPLATE_NAME } from "./Link";

interface Route {
  name: string;
  path: string;
  component?: any;
  redirect?: Destination;
  params: string[];
}

export type RouteParams = { [key: string]: string | number };

export interface RouterEnv extends Env {
  router: Router;
}

export interface Destination {
  path?: string;
  to?: string;
  params?: RouteParams;
}

interface Options {
  mode: Router["mode"];
}

const paramRegexp = /\{\{(.*?)\}\}/;

export class Router {
  currentRoute: Route | null = null;
  currentParams: RouteParams | null = null;
  mode: "history" | "hash";

  routes: { [id: string]: Route };
  routeIds: string[];
  env: RouterEnv;

  constructor(env: Env, routes: Partial<Route>[], options: Options = { mode: "history" }) {
    env.router = this;
    this.mode = options.mode;
    this.env = env as RouterEnv;

    this.routes = {};
    this.routeIds = [];
    let nextId = 1;
    for (let partialRoute of routes) {
      if (!partialRoute.name) {
        partialRoute.name = "__route__" + nextId++;
      }
      if (partialRoute.component) {
        QWeb.register("__component__" + partialRoute.name, partialRoute.component);
      }
      if (partialRoute.redirect) {
        this.validateDestination(partialRoute.redirect);
      }
      partialRoute.params = partialRoute.path ? findParams(partialRoute.path) : [];
      this.routes[partialRoute.name] = partialRoute as Route;
      this.routeIds.push(partialRoute.name);
    }

    this.checkRoute();

    this.checkAndUpdateRoute = this.checkAndUpdateRoute.bind(this);
    window.addEventListener("popstate", this.checkAndUpdateRoute);

    // setup link and directive
    env.qweb.addTemplate(LINK_TEMPLATE_NAME, LINK_TEMPLATE);
    QWeb.addDirective(makeDirective(<RouterEnv>env));
  }

  navigate(to: Destination): void {
    const url = this.destToUrl(to);
    history.pushState({}, url, location.origin + url);
    this.checkAndUpdateRoute();
  }

  destToUrl(dest: Destination): string {
    this.validateDestination(dest);
    return dest.path || this.routeToURL(this.routes[dest.to!].path, dest.params!);
  }

  get currentRouteName(): string | null {
    return this.currentRoute && this.currentRoute.name;
  }

  private validateDestination(dest: Destination) {
    if ((!dest.path && !dest.to) || (dest.path && dest.to)) {
      throw new Error(`Invalid destination: ${JSON.stringify(dest)}`);
    }
  }

  private routeToURL(path: string, params: RouteParams): string {
    const parts = path.split("/");
    const l = parts.length;
    for (let i = 0; i < l; i++) {
      const part = parts[i];
      const match = part.match(paramRegexp);
      if (match) {
        const key = match[1].split(".")[0];
        parts[i] = <string>params[key];
      }
    }
    return parts.join("/");
  }

  private checkRoute(): void {
    let currentPath =
      this.mode === "history" ? window.location.pathname : window.location.hash.slice(1);
    currentPath = currentPath || "/";
    for (let routeId of this.routeIds) {
      let route = this.routes[routeId];
      let params = this.matchRoute(route.path, currentPath);
      if (params) {
        if (route.redirect) {
          this.navigate(route.redirect);
          return;
        }
        this.currentRoute = route;
        this.currentParams = params;
        return;
      }
    }
    this.currentRoute = null;
    this.currentParams = {};
  }

  protected checkAndUpdateRoute(): void {
    const initialName = this.currentRoute ? this.currentRoute.name : null;
    this.checkRoute();
    const currentName = this.currentRoute ? this.currentRoute.name : null;

    if (currentName !== initialName) {
      this.env.qweb.forceUpdate();
    }
  }

  private matchRoute(routePath: string, path: string): RouteParams | false {
    if (routePath === "*") {
      return {};
    }
    const descrParts = routePath.split("/");
    const targetParts = path.split("/");
    const l = descrParts.length;
    if (l !== targetParts.length) {
      return false;
    }
    const result = {};
    for (let i = 0; i < l; i++) {
      const descr = descrParts[i];
      let target: string | number = targetParts[i];
      const match = descr.match(paramRegexp);
      if (match) {
        const [key, suffix] = match[1].split(".");
        if (suffix === "number") {
          target = parseInt(target, 10);
        }
        result[key] = target;
      } else if (descr !== target) {
        return false;
      }
    }
    return result;
  }
}

function findParams(str: string): string[] {
  const globalParamRegexp = /\{\{(.*?)\}\}/g;
  const result: string[] = [];
  let m;
  do {
    m = globalParamRegexp.exec(str);
    if (m) {
      result.push(m[1].split(".")[0]);
    }
  } while (m);
  return result;
}
