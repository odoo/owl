import { EventBus } from "../core/event_bus";

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface RPCModelQuery {
  model: string;
  method: string;
  args?: any[];
  kwargs?: { [key: string]: any };
  context?: { [key: string]: any };
}

export interface RPCControllerQuery {
  route: string;
  params: { [key: string]: any };
}

export type RPCQuery = RPCModelQuery | RPCControllerQuery;

type AjaxStatus = "loading" | "notloading";

export interface IAjax {
  rpc(rpc: RPCQuery): Promise<any>;
  on(event: "rpc_status", owner: any, callback: (status: AjaxStatus) => void);
}

interface RequestParameters {
  route: string;
  params: { [key: string]: any };
}

export type FetchMethod = (route: string, params: any) => Promise<any>;

//------------------------------------------------------------------------------
// Ajax
//------------------------------------------------------------------------------

export class Ajax extends EventBus implements IAjax {
  fetch: FetchMethod;
  counter: number = 0;

  constructor(fetch: FetchMethod) {
    super();
    this.fetch = fetch;
  }

  async rpc(rpc: RPCQuery): Promise<any> {
    const request = this.prepareRequest(rpc);
    if (this.counter === 0) {
      this.trigger("rpc_status", "loading");
    }
    this.counter++;
    const result = await this.fetch(request.route, request.params);
    this.counter--;
    if (this.counter === 0) {
      this.trigger("rpc_status", "notloading");
    }
    return result;
  }

  private prepareRequest(query: RPCQuery): RequestParameters {
    let route: string;
    let params = "params" in query ? query.params : {};
    if ("route" in query) {
      route = query.route;
    } else if ("model" in query && "method" in query) {
      route = `/web/dataset/call_kw/${query.model}/${query.method}`;
      params.args = query.args || [];
      params.model = query.model;
      params.method = query.method;
      params.kwargs = Object.assign(params.kwargs || {}, query.kwargs);
      params.kwargs.context =
        query.context || params.context || params.kwargs.context;
    } else {
      throw new Error("Invalid Query");
    }

    // doing this remove empty keys, and undefined stuff
    const sanitizedParams = JSON.parse(JSON.stringify(params));
    return { route, params: sanitizedParams };
  }
}
