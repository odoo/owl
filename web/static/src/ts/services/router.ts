import { Bus } from "../core/bus";

export type Query = { [key: string]: string };

function clearSlashes(s: string): string {
  return s.replace(/\/$/, "").replace(/^\//, "");
}

export class Router extends Bus {
  currentQuery: Query;

  constructor() {
    super();
    this.currentQuery = this.getQuery();
    window.onhashchange = () => {
      this.currentQuery = this.getQuery();
      this.trigger("query_changed", this.currentQuery);
    };
  }

  /**
   * @param {Query} query
   */
  navigate(query: Query) {
    const url = this.formatURL("", query);
    window.history.replaceState(null, document.title, url);
  }

  formatQuery(query: Query): string {
    let parts: string[] = [];
    for (let key in query) {
      parts.push(`${key}=${query[key]}`);
    }
    return parts.join("&");
  }

  formatURL(path: string, query: Query): string {
    let url = clearSlashes(path);
    return `/${url}#${this.formatQuery(query)}`;
  }

  getQuery(): Query {
    const query = {};
    for (let part of window.location.hash.slice(1).split("?")) {
      let [key, value] = part.split("=");
      query[key] = value;
    }
    return query;
  }
}
