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

export interface IAjax {
  rpc(rpc: RPCQuery): Promise<any>;
}

interface RequestParameters {
  route: string;
  params: { [key: string]: any };
}

//------------------------------------------------------------------------------
// Ajax
//------------------------------------------------------------------------------

export class Ajax implements IAjax {
  rpc(rpc: RPCQuery): Promise<any> {
    const request = this.prepareRequest(rpc);
    console.log("RPC", request.route, request.params);
    const delay = Math.random() * 150;
    return new Promise(resolve => setTimeout(resolve, delay));
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
