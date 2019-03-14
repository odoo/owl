import { Callback } from "../../../../src/event_bus";
import { IRouter, Query, RouterEvent } from "../../src/ts/services/router";

export class MockRouter implements IRouter {
  currentQuery: Query;

  constructor(query: Query = {}) {
    this.currentQuery = query;
  }

  navigate(query: Query) {
    this.currentQuery = query;
  }
  on(event: RouterEvent, owner: any, callback: Callback) {}
  getQuery(): Query {
    return this.currentQuery;
  }

  formatURL(path: string, query: Query): string {
    return "";
  }
}
