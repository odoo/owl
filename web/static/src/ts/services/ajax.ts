//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export interface RPCQuery {
  model: string;
  method: string;
  args: any;
}
export interface IAjax {
  rpc(rpc: RPCQuery): Promise<any>;
}

//------------------------------------------------------------------------------
// Ajax
//------------------------------------------------------------------------------

export class Ajax implements IAjax {
  rpc(rpc: RPCQuery): Promise<any> {
    return Promise.resolve(1);
  }
}
