import { Env } from "../component/component";
import { QWeb } from "../qweb/index";
import { makeDirective } from "./directive";
import { LINK_TEMPLATE, LINK_TEMPLATE_NAME } from "./Link";

interface Route {
  name?: string;
  path: string;
  component?: any;
}

export interface RouteDescription extends Route {
  name: string;
  params: string[];
}

export type RouteParams = { [key: string]: string | number };

export interface RouterEnv extends Env {
  router: Router;
}

export interface Destination {
  to?: string;
  route?: string;
  params?: RouteParams;
}
interface Router {
  navigate: (dest: Destination) => void;
  routeName: string | null;
  routeParams: RouteParams;
  info: RouterInfo;
}

interface RouterInfo {
  mode: Options["mode"];
  routes: { [id: string]: RouteDescription };
  routeIds: string[];
  destToUrl: (dest: Destination) => string;
}

interface Options {
  mode: "history" | "hash";
}

const paramRegexp = /\{\{(.*?)\}\}/;

function findParams(str: string): string[] {
  const globalParamRegexp = /\{\{(.*?)\}\}/g;
  const result: string[] = [];
  let m;
  do {
    m = globalParamRegexp.exec(str);
    if (m) {
      result.push(m[1].split('.')[0]);
    }
  } while (m);
  return result;
}

export function activate(env: Env, routes: Route[], options?: Options) {
  // process routes and build proper internal data structures
  const mode = options ? options.mode : "hash";
  const info: RouterInfo = { routes: {}, routeIds: [], mode, destToUrl: destToURL.bind(null, env) };
  let nextId = 1;
  for (let route of routes) {
    if (!route.name) {
      route.name = "__route__" + nextId++;
    }
    if (route.component) {
      QWeb.register("__component__" + route.name, route.component);
    }
    (<RouteDescription>route).params = findParams(route.path);
    info.routes[route.name] = <RouteDescription>route;
    info.routeIds.push(route.name);
  }

  const router: Router = { navigate, routeName: null, routeParams: {}, info };

  env.router = router;

  checkRoute(<RouterEnv>env);

  function navigate(dest: Destination) {
    const to = destToURL(<RouterEnv>env, dest);
    history.pushState({}, to, location.origin + to);
    checkAndUpdateRoute(<RouterEnv>env);
  }

  addEventListener("popstate", () => checkAndUpdateRoute(<RouterEnv>env));

  // setup link and directive
  env.qweb.addTemplate(LINK_TEMPLATE_NAME, LINK_TEMPLATE);
  QWeb.addDirective(makeDirective(<RouterEnv>env));
}

function checkRoute(env: RouterEnv): void {
  const info = env.router.info;
  let currentPath =
    info.mode === "history" ? window.location.pathname : window.location.hash.slice(1);
  currentPath = currentPath || "/";
  for (let routeId of info.routeIds) {
    let route = info.routes[routeId];
    let params = matchRoute(route, currentPath);
    if (params) {
      env.router.routeName = route.name!;
      env.router.routeParams = params;
      return;
    }
  }
  env.router.routeName = null;
  env.router.routeParams = {};
}

function checkAndUpdateRoute(env: RouterEnv): void {
  const currentRoute = env.router.routeName;
  checkRoute(env);
  if (env.router.routeName !== currentRoute) {
    env.qweb.forceUpdate();
  }
}

export function matchRoute(route: Route, path: string): RouteParams | false {
  if (route.path === "*") {
    return {};
  }
  const descrParts = route.path.split("/");
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

export function destToURL(env: RouterEnv, dest: Destination): string {
  return dest.to || routeToURL(env.router.info.routes[dest.route!].path, dest.params!);
}

export function routeToURL(path: string, params: RouteParams): string {
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
